export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      attendances: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          support_team_id: string;
          ticket_image_url: string | null;
          ticket_image_hash: string | null;
          verified: boolean;
          verified_at: string | null;
          verified_method: Database["public"]["Enums"]["verified_method"] | null;
          vision_payload: Json | null;
          memo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          support_team_id: string;
          ticket_image_url?: string | null;
          ticket_image_hash?: string | null;
          verified?: boolean;
          verified_at?: string | null;
          verified_method?: Database["public"]["Enums"]["verified_method"] | null;
          vision_payload?: Json | null;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendances"]["Insert"]>;
        Relationships: [];
      };
      friend_requests: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          status: Database["public"]["Enums"]["friend_request_status"];
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          from_user_id: string;
          to_user_id: string;
          status?: Database["public"]["Enums"]["friend_request_status"];
          created_at?: string;
          responded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["friend_requests"]["Insert"]>;
        Relationships: [];
      };
      friends: {
        Row: {
          user_a_id: string;
          user_b_id: string;
          created_at: string;
        };
        Insert: {
          user_a_id: string;
          user_b_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["friends"]["Insert"]>;
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          external_id: string | null;
          game_date: string;
          game_time: string | null;
          stadium: string;
          home_team_id: string;
          away_team_id: string;
          home_score: number | null;
          away_score: number | null;
          status: Database["public"]["Enums"]["game_status"];
          innings: number | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          external_id?: string | null;
          game_date: string;
          game_time?: string | null;
          stadium: string;
          home_team_id: string;
          away_team_id: string;
          home_score?: number | null;
          away_score?: number | null;
          status?: Database["public"]["Enums"]["game_status"];
          innings?: number | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          actor_user_id: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_user_id: string;
          actor_user_id?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          nickname: string;
          main_team_id: string;
          main_team_changed_at: string | null;
          interest_team_ids: string[];
          notifications_enabled: boolean;
          default_public_scope: Database["public"]["Enums"]["public_scope"];
          avatar_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname: string;
          main_team_id: string;
          main_team_changed_at?: string | null;
          interest_team_ids?: string[];
          notifications_enabled?: boolean;
          default_public_scope?: Database["public"]["Enums"]["public_scope"];
          avatar_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      review_likes: {
        Row: {
          user_id: string;
          review_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          review_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_likes"]["Insert"]>;
        Relationships: [];
      };
      review_saves: {
        Row: {
          user_id: string;
          review_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          review_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_saves"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          attendance_id: string;
          body: string;
          photos: string[];
          public_scope: Database["public"]["Enums"]["public_scope"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          attendance_id: string;
          body: string;
          photos?: string[];
          public_scope?: Database["public"]["Enums"]["public_scope"];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
      team_standings: {
        Row: {
          id: string;
          team_id: string;
          season: number;
          rank: number;
          wins: number;
          losses: number;
          draws: number;
          games_behind: string;
          form: Database["public"]["Enums"]["attendance_result"][];
          source_payload: Json | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          season: number;
          rank: number;
          wins?: number;
          losses?: number;
          draws?: number;
          games_behind?: string;
          form?: Database["public"]["Enums"]["attendance_result"][];
          source_payload?: Json | null;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_standings"]["Insert"]>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          initial: string;
          color: string;
          accent: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          short_name: string;
          initial: string;
          color: string;
          accent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      profile_stats: {
        Row: {
          user_id: string;
          attendance_count: number;
          wins: number;
          losses: number;
          draws: number;
          win_rate: number;
        };
      };
      verified_attendance_results: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          support_team_id: string;
          result: Database["public"]["Enums"]["attendance_result"] | null;
        };
      };
    };
    Functions: {
      game_result_for_support_team: {
        Args: {
          home_team_id: string;
          away_team_id: string;
          home_score: number | null;
          away_score: number | null;
          support_team_id: string;
        };
        Returns: Database["public"]["Enums"]["attendance_result"] | null;
      };
    };
    Enums: {
      attendance_result: "win" | "lose" | "draw";
      friend_request_status: "pending" | "accepted" | "rejected" | "canceled";
      game_status: "scheduled" | "in_progress" | "finished" | "canceled";
      notification_type: "friend_request" | "friend_accepted" | "review_like" | "review_comment" | "attendance_verified" | "system";
      public_scope: "public" | "friends" | "private";
      verified_method: "ticket_image_vision" | "manual" | "mock";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
