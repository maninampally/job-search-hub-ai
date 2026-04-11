import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../../stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should set user and token', () => {
    const { result } = renderHook(() => useAuthStore());
    const testUser = { id: '123', email: 'test@example.com' };
    const testToken = 'fake-token-12345';

    act(() => {
      result.current.setUser(testUser);
      result.current.setAccessToken(testToken);
    });

    expect(result.current.user).toEqual(testUser);
    expect(result.current.accessToken).toBe(testToken);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should set error message', () => {
    const { result } = renderHook(() => useAuthStore());
    const errorMsg = 'Authentication failed';

    act(() => {
      result.current.setError(errorMsg);
    });

    expect(result.current.error).toBe(errorMsg);
  });

  it('should logout and clear state', () => {
    const { result } = renderHook(() => useAuthStore());

    // Set initial state
    act(() => {
      result.current.setUser({ id: '123', email: 'test@example.com' });
      result.current.setAccessToken('token');
    });

    // Logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle MFA challenge state', () => {
    const { result } = renderHook(() => useAuthStore());
    const preAuthToken = 'pre-auth-token';

    act(() => {
      result.current.setMFAChallenge(true, preAuthToken);
    });

    expect(result.current.mfaChallengeRequired).toBe(true);
    expect(result.current.preAuthToken).toBe(preAuthToken);
  });
});
