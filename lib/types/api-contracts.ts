import type { Game, Team, TeamStanding } from "@/lib/types/domain";

export type Id = string;

export type PublicScope = "public" | "friends" | "private";
export type AttendanceResult = "win" | "lose" | "draw";
export type GameStatus = "scheduled" | "in_progress" | "finished" | "canceled";
export type VerifiedMethod = "ticket_image_vision" | "manual" | "mock";
export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "canceled";

export type UserProfileRecord = {
  id: Id;
  nickname: string;
  mainTeamId: Team["id"];
  mainTeamChangedAt: string | null;
  interestTeamIds: Team["id"][];
  notificationsEnabled: boolean;
  defaultPublicScope: PublicScope;
  avatarImageUrl: string | null;
  /** 자기소개 (최대 150자, 한 줄). null이면 미입력 상태. */
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GameRecord = Omit<Game, "date" | "time" | "status"> & {
  date: string;
  time: string | null;
  status: GameStatus;
  innings: number | null;
};

export type AttendanceRecord = {
  id: Id;
  userId: Id;
  gameId: Id;
  supportTeamId: Team["id"];
  ticketImageUrl: string | null;
  verified: boolean;
  verifiedAt: string | null;
  verifiedMethod: VerifiedMethod | null;
  memo: string | null;
  createdAt: string;
  result: AttendanceResult | null;
  game: GameRecord;
};

export type ReviewRecord = {
  id: Id;
  userId: Id;
  attendanceId: Id;
  body: string;
  photos: string[];
  publicScope: PublicScope;
  createdAt: string;
  updatedAt: string;
  author: Pick<UserProfileRecord, "id" | "nickname" | "mainTeamId" | "avatarImageUrl">;
  attendance: AttendanceRecord;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
};

export type FriendProfile = Pick<UserProfileRecord, "id" | "nickname" | "mainTeamId" | "avatarImageUrl"> & {
  attendanceCount: number;
};

export type FriendRequestRecord = {
  id: Id;
  fromUser: FriendProfile;
  toUser: FriendProfile;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt: string | null;
};

export type ProfileStats = {
  attendanceCount: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
};

export type CreateAttendanceInput = {
  gameId: Id;
  supportTeamId: Team["id"];
  ticketImageFile?: File;
  memo?: string;
};

export type UpdateAttendanceInput = Partial<Pick<CreateAttendanceInput, "supportTeamId" | "memo">> & {
  id: Id;
};

export type CreateReviewInput = {
  attendanceId: Id;
  body: string;
  photos: File[];
  publicScope: PublicScope;
};

export type UpdateReviewInput = Partial<Omit<CreateReviewInput, "attendanceId">> & {
  id: Id;
};

export type UpdateProfileInput = {
  nickname?: string;
  mainTeamId?: Team["id"];
  interestTeamIds?: Team["id"][];
  notificationsEnabled?: boolean;
  defaultPublicScope?: PublicScope;
  avatarImageFile?: File;
  /** 자기소개 (최대 150자, 한 줄). null/빈 문자열이면 비움. */
  bio?: string | null;
};

export type CommunityFeedFilter = "all" | "myTeam" | "friends";

export type ApiContracts = {
  getBootstrap: () => Promise<{
    profile: UserProfileRecord;
    stats: ProfileStats;
    teams: Team[];
    standings: TeamStanding[];
    upcomingGames: GameRecord[];
  }>;
  listGames: (params: { from: string; to: string; teamId?: Team["id"] }) => Promise<GameRecord[]>;
  listAttendances: (params?: { verified?: boolean }) => Promise<AttendanceRecord[]>;
  createAttendance: (input: CreateAttendanceInput) => Promise<AttendanceRecord>;
  updateAttendance: (input: UpdateAttendanceInput) => Promise<AttendanceRecord>;
  deleteAttendance: (id: Id) => Promise<void>;
  listReviews: (params: { filter: CommunityFeedFilter }) => Promise<ReviewRecord[]>;
  createReview: (input: CreateReviewInput) => Promise<ReviewRecord>;
  updateReview: (input: UpdateReviewInput) => Promise<ReviewRecord>;
  deleteReview: (id: Id) => Promise<void>;
  toggleReviewLike: (reviewId: Id) => Promise<{ liked: boolean; likeCount: number }>;
  toggleReviewSave: (reviewId: Id) => Promise<{ saved: boolean }>;
  searchUsers: (query: string) => Promise<FriendProfile[]>;
  listFriends: () => Promise<FriendProfile[]>;
  sendFriendRequest: (toUserId: Id) => Promise<FriendRequestRecord>;
  respondFriendRequest: (requestId: Id, status: "accepted" | "rejected") => Promise<FriendRequestRecord>;
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfileRecord>;
};

