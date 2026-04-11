import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJobsStore } from '../../stores/jobsStore';

describe('jobsStore', () => {
  beforeEach(() => {
    useJobsStore.setState({
      jobs: [],
      filteredJobs: [],
      filterStatus: 'all',
      isLoading: false,
      syncInProgress: false,
      syncStatus: null,
    });
  });

  it('should initialize with empty jobs', () => {
    const { result } = renderHook(() => useJobsStore());
    
    expect(result.current.jobs).toEqual([]);
    expect(result.current.filteredJobs).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should add a job', () => {
    const { result } = renderHook(() => useJobsStore());
    const newJob = {
      id: '1',
      company: 'Google',
      role: 'Software Engineer',
      status: 'Applied',
    };

    act(() => {
      result.current.addJob(newJob);
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0]).toEqual(newJob);
  });

  it('should filter jobs by status', () => {
    const { result } = renderHook(() => useJobsStore());
    const jobs = [
      { id: '1', company: 'Google', role: 'SE', status: 'Applied' },
      { id: '2', company: 'Microsoft', role: 'PM', status: 'Wishlist' },
      { id: '3', company: 'Apple', role: 'SE', status: 'Applied' },
    ];

    act(() => {
      result.current.setJobs(jobs);
      result.current.setFilterStatus('Applied');
    });

    const filtered = result.current.filteredJobs;
    expect(filtered).toHaveLength(2);
    expect(filtered.every(job => job.status === 'Applied')).toBe(true);
  });

  it('should update job status', () => {
    const { result } = renderHook(() => useJobsStore());
    const job = {
      id: '1',
      company: 'Google',
      role: 'SE',
      status: 'Wishlist',
    };

    act(() => {
      result.current.addJob(job);
      result.current.updateJobStatus('1', 'Applied');
    });

    expect(result.current.jobs[0].status).toBe('Applied');
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useJobsStore());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should clear all jobs', () => {
    const { result } = renderHook(() => useJobsStore());

    act(() => {
      result.current.addJob({ id: '1', company: 'Google' });
      result.current.addJob({ id: '2', company: 'Microsoft' });
    });

    expect(result.current.jobs).toHaveLength(2);

    act(() => {
      result.current.clearJobs();
    });

    expect(result.current.jobs).toHaveLength(0);
  });
});
