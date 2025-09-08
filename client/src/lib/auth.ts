import { queryClient } from "./queryClient";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  academicYear: string;
  gender: string;
  major: string;
  isVerified: boolean;
  rating: number;
  totalRides: number;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export const setAuthToken = (token: string) => {
  localStorage.setItem('token', token);
};

export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const removeAuthToken = () => {
  localStorage.removeItem('token');
  queryClient.clear();
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
