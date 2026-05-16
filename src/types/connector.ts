export interface ConnectorToken {
  id?: string;
  userId: string;
  email?: string;
  provider: "google" | "github" | "google-workspace";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  updatedAt: string;
  createdAt: string;
}

export interface ConnectorStatus {
  provider: "google" | "github" | "google-workspace";
  connected: boolean;
  email?: string;
  expiresAt?: string;
}
