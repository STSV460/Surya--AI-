export interface ConnectorToken {
  id?: string;
  userId: string;
  email?: string;
  provider: "google" | "github";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  updatedAt: string;
  createdAt: string;
}

export interface ConnectorStatus {
  provider: "google" | "github";
  connected: boolean;
  email?: string;
  expiresAt?: string;
}
