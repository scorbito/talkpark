import type { Review, ReviewComment } from "@/lib/types/domain";
import { getTeam } from "@/lib/constants/teams";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type ReviewRow = {
  id: string;
  user_id: string;
  attendance_id: string;
  body: string;
  photos: string[];
  public_scope: "public" | "friends" | "private";
  created_at: string;
};

type ReviewProfileRow = {
  id: string;
  nickname: string;
  main_team_id: string;
  avatar_image_url?: string | null;
};

type ReviewAttendanceRow = {
  id: string;
  support_team_id: string;
  game_id: string;
};

function sortFriendPair(a: string, b: string) {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function listFriendIds(userId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const [asA, asB] = await Promise.all([
    admin.from("friends").select("user_b_id").eq("user_a_id", userId),
    admin.from("friends").select("user_a_id").eq("user_b_id", userId)
  ]);
  return [
    ...(asA.data ?? []).map((row) => row.user_b_id),
    ...(asB.data ?? []).map((row) => row.user_a_id)
  ];
}

async function canViewReview(ownerId: string, publicScope: ReviewRow["public_scope"], viewerId: string | null) {
  if (publicScope === "public") return true;
  if (!viewerId) return false;
  if (ownerId === viewerId) return true;
  if (publicScope !== "friends") return false;

  const admin = createSupabaseAdminClient();
  const pair = sortFriendPair(ownerId, viewerId);
  const { data } = await admin
    .from("friends")
    .select("user_a_id")
    .eq("user_a_id", pair.userA)
    .eq("user_b_id", pair.userB)
    .maybeSingle();

  return Boolean(data);
}

function getTimeAgo(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function extractHashtags(body: string): string[] {
  const matches = body.match(/#[가-힣ㄱ-ㆎa-zA-Z0-9_]+/g) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of matches) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
      if (result.length >= 20) break;
    }
  }
  return result;
}

function deriveGameResult(homeScore: number | null, awayScore: number | null, supportTeamId: string, homeTeamId: string, awayTeamId: string): "win" | "lose" | "draw" | null {
  if (homeScore === null || awayScore === null) return null;
  if (homeScore === awayScore) return "draw";
  if (supportTeamId === homeTeamId) return homeScore > awayScore ? "win" : "lose";
  if (supportTeamId === awayTeamId) return awayScore > homeScore ? "win" : "lose";
  return null;
}

function toReview(row: ReviewRow, profile: ReviewProfileRow | undefined, attendance: ReviewAttendanceRow | undefined, game: {
  game_date: string;
  stadium: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
} | undefined, commentCount = 0, likeCount = 0): Review {
  const homeName = game?.home_team_id ? getTeam(game.home_team_id).shortName : "";
  const awayName = game?.away_team_id ? getTeam(game.away_team_id).shortName : "";
  const score = game?.home_score !== null && game?.away_score !== null && game
    ? `${game.home_score} : ${game.away_score}`
    : "경기전";
  const date = game?.game_date ? game.game_date.replaceAll("-", ".") : "";
  const supportTeamId = attendance?.support_team_id ?? profile?.main_team_id ?? "lg";

  return {
    id: row.id,
    ownerId: row.user_id,
    publicScope: row.public_scope,
    author: profile?.nickname ?? "승요팬",
    teamId: supportTeamId,
    timeAgo: getTimeAgo(row.created_at),
    title: "",
    body: row.body,
    gameLabel: date && homeName && awayName ? `${date} · ${homeName} ${score} ${awayName}` : "",
    image: row.photos[0] ?? "/assets/mainherobg.png",
    images: row.photos.length > 0 ? row.photos : ["/assets/mainherobg.png"],
    likes: likeCount,
    comments: commentCount,
    tags: extractHashtags(row.body),
    attendanceId: row.attendance_id,
    createdAt: row.created_at,
    authorAvatarUrl: profile?.avatar_image_url ?? null,
    game: game ? {
      date,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeScore: game.home_score,
      awayScore: game.away_score,
      stadium: game.stadium,
      supportTeamId,
      result: deriveGameResult(game.home_score, game.away_score, supportTeamId, game.home_team_id, game.away_team_id)
    } : undefined
  };
}

export async function listReviewsFromDb(params: { onlyMine?: boolean; cursor?: string; limit?: number } = {}): Promise<Review[]> {
  const admin = createSupabaseAdminClient();
  const viewerId = await getCurrentUserId();

  let reviewQuery = admin
    .from("reviews")
    .select("id,user_id,attendance_id,body,photos,public_scope,created_at")
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 20);

  if (params.cursor) {
    reviewQuery = reviewQuery.lt("created_at", params.cursor);
  }

  if (params.onlyMine) {
    if (!viewerId) {
      return [];
    }
    reviewQuery = reviewQuery.eq("user_id", viewerId);
  } else if (viewerId) {
    const friendIds = await listFriendIds(viewerId);
    const visibleFilters = [`public_scope.eq.public`, `user_id.eq.${viewerId}`];
    if (friendIds.length > 0) {
      visibleFilters.push(`and(public_scope.eq.friends,user_id.in.(${friendIds.join(",")}))`);
    }
    reviewQuery = reviewQuery.or(visibleFilters.join(","));
  } else {
    reviewQuery = reviewQuery.eq("public_scope", "public");
  }

  const { data: reviews, error: reviewError } = await reviewQuery;

  if (reviewError) {
    throw new Error(`Failed to load reviews: ${reviewError.message}`);
  }

  if (reviews.length === 0) {
    return [];
  }

  const userIds = Array.from(new Set(reviews.map((review) => review.user_id)));
  const attendanceIds = Array.from(new Set(reviews.map((review) => review.attendance_id)));

  const [{ data: profiles, error: profileError }, { data: attendances, error: attendanceError }] = await Promise.all([
    admin.from("profiles").select("id,nickname,main_team_id,avatar_image_url").in("id", userIds),
    admin.from("attendances").select("id,support_team_id,game_id").in("id", attendanceIds)
  ]);

  if (profileError) {
    throw new Error(`Failed to load review profiles: ${profileError.message}`);
  }
  if (attendanceError) {
    throw new Error(`Failed to load review attendances: ${attendanceError.message}`);
  }

  const gameIds = Array.from(new Set(attendances.map((attendance) => attendance.game_id)));
  const { data: games, error: gameError } = await admin
    .from("games")
    .select("id,game_date,stadium,home_team_id,away_team_id,home_score,away_score")
    .in("id", gameIds);

  if (gameError) {
    throw new Error(`Failed to load review games: ${gameError.message}`);
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const attendancesById = new Map(attendances.map((attendance) => [attendance.id, attendance]));
  const gamesById = new Map(games.map((game) => [game.id, game]));

  // 댓글 + 좋아요 카운트 병렬 집계
  const commentCounts = new Map<string, number>();
  const likeCounts = new Map<string, number>();
  const reviewIds = reviews.map((r) => r.id);
  if (reviewIds.length > 0) {
    const [commentsResult, likesResult] = await Promise.all([
      admin.from("review_comments").select("review_id").in("review_id", reviewIds),
      admin.from("review_likes").select("review_id").in("review_id", reviewIds)
    ]);
    for (const c of commentsResult.data ?? []) {
      commentCounts.set(c.review_id, (commentCounts.get(c.review_id) ?? 0) + 1);
    }
    for (const l of likesResult.data ?? []) {
      likeCounts.set(l.review_id, (likeCounts.get(l.review_id) ?? 0) + 1);
    }
  }

  return reviews.map((review) => {
    const attendance = attendancesById.get(review.attendance_id);
    return toReview(
      review,
      profilesById.get(review.user_id),
      attendance,
      attendance ? gamesById.get(attendance.game_id) : undefined,
      commentCounts.get(review.id) ?? 0,
      likeCounts.get(review.id) ?? 0
    );
  });
}

export async function getReviewByIdFromDb(id: string): Promise<Review | null> {
  const admin = createSupabaseAdminClient();
  const viewerId = await getCurrentUserId();
  const { data: review, error } = await admin
    .from("reviews")
    .select("id,user_id,attendance_id,body,photos,public_scope,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load review: ${error.message}`);
  if (!review) return null;
  if (!(await canViewReview(review.user_id, review.public_scope, viewerId))) return null;

  const [{ data: profile }, { data: attendance }, { count: commentCount }, { count: likeCount }] = await Promise.all([
    admin.from("profiles").select("id,nickname,main_team_id,avatar_image_url").eq("id", review.user_id).maybeSingle(),
    admin.from("attendances").select("id,support_team_id,game_id").eq("id", review.attendance_id).maybeSingle(),
    admin.from("review_comments").select("id", { count: "exact", head: true }).eq("review_id", id),
    admin.from("review_likes").select("user_id", { count: "exact", head: true }).eq("review_id", id)
  ]);

  let game: { game_date: string; stadium: string; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null } | undefined;
  if (attendance) {
    const { data: g } = await admin
      .from("games")
      .select("game_date,stadium,home_team_id,away_team_id,home_score,away_score")
      .eq("id", attendance.game_id)
      .maybeSingle();
    if (g) game = g;
  }

  return toReview(review, profile ?? undefined, attendance ?? undefined, game, commentCount ?? 0, likeCount ?? 0);
}

/** 현재 로그인 사용자가 좋아요/저장한 리뷰 ID 모음. 비로그인이면 빈 배열들. */
export async function getCurrentUserReviewReactionsFromDb(): Promise<{
  likedReviewIds: string[];
  savedReviewIds: string[];
}> {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return { likedReviewIds: [], savedReviewIds: [] };
  const me = authData.user.id;

  const [likes, saves] = await Promise.all([
    supabase.from("review_likes").select("review_id").eq("user_id", me),
    supabase.from("review_saves").select("review_id").eq("user_id", me)
  ]);

  return {
    likedReviewIds: (likes.data ?? []).map((row) => row.review_id),
    savedReviewIds: (saves.data ?? []).map((row) => row.review_id)
  };
}

/** 현재 사용자가 저장한 리뷰 전체. 마이 → 저장한 후기 페이지에서 사용. */
export async function listSavedReviewsFromDb(): Promise<Review[]> {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return [];
  const me = authData.user.id;

  const { data: saves, error: savesError } = await supabase
    .from("review_saves")
    .select("review_id, created_at")
    .eq("user_id", me)
    .order("created_at", { ascending: false });

  if (savesError || !saves || saves.length === 0) return [];

  const reviewIds = saves.map((row) => row.review_id);
  const admin = createSupabaseAdminClient();

  const { data: reviews, error: reviewsError } = await admin
    .from("reviews")
    .select("id,user_id,attendance_id,body,photos,public_scope,created_at")
    .in("id", reviewIds);

  if (reviewsError || !reviews) return [];

  const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
  const attendanceIds = Array.from(new Set(reviews.map((r) => r.attendance_id)));

  const [{ data: profiles }, { data: attendances }] = await Promise.all([
    admin.from("profiles").select("id,nickname,main_team_id,avatar_image_url").in("id", userIds),
    admin.from("attendances").select("id,support_team_id,game_id").in("id", attendanceIds)
  ]);

  const gameIds = Array.from(new Set((attendances ?? []).map((a) => a.game_id)));
  const { data: games } = await admin
    .from("games")
    .select("id,game_date,stadium,home_team_id,away_team_id,home_score,away_score")
    .in("id", gameIds);

  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const attendancesById = new Map((attendances ?? []).map((a) => [a.id, a]));
  const gamesById = new Map((games ?? []).map((g) => [g.id, g]));

  // 댓글/좋아요 카운트
  const commentCounts = new Map<string, number>();
  const likeCounts = new Map<string, number>();
  const [commentsResult, likesResult] = await Promise.all([
    admin.from("review_comments").select("review_id").in("review_id", reviewIds),
    admin.from("review_likes").select("review_id").in("review_id", reviewIds)
  ]);
  for (const c of commentsResult.data ?? []) {
    commentCounts.set(c.review_id, (commentCounts.get(c.review_id) ?? 0) + 1);
  }
  for (const l of likesResult.data ?? []) {
    likeCounts.set(l.review_id, (likeCounts.get(l.review_id) ?? 0) + 1);
  }

  // saves 의 created_at 순서대로 정렬
  const reviewsById = new Map(reviews.map((r) => [r.id, r]));
  const result: Review[] = [];
  for (const save of saves) {
    const review = reviewsById.get(save.review_id);
    if (!review) continue;
    const attendance = attendancesById.get(review.attendance_id);
    result.push(
      toReview(
        review,
        profilesById.get(review.user_id),
        attendance,
        attendance ? gamesById.get(attendance.game_id) : undefined,
        commentCounts.get(review.id) ?? 0,
        likeCounts.get(review.id) ?? 0
      )
    );
  }
  return result;
}

export async function listCommentsByReviewId(reviewId: string): Promise<ReviewComment[]> {
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("review_comments")
    .select("id, review_id, user_id, body, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load comments: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, nickname, main_team_id, avatar_image_url")
    .in("id", userIds);
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    return {
      id: row.id,
      reviewId: row.review_id,
      userId: row.user_id,
      authorNickname: profile?.nickname ?? "승요팬",
      authorTeamId: profile?.main_team_id ?? "lg",
      authorAvatarUrl: profile?.avatar_image_url ?? null,
      body: row.body,
      createdAt: row.created_at,
      timeAgo: getTimeAgo(row.created_at)
    };
  });
}
