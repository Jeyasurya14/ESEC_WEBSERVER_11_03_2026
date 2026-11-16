import { Injector, createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest, resourceRequest } from './api-request';

describe('HTTP request lifetime', () => {
  it('unsubscribes after receiving its first response', async () => {
    const released = vi.fn();
    const response = new Observable<number>((subscriber) => {
      subscriber.next(42);
      return released;
    });
    expect(await apiRequest(response)).toBe(42);
    expect(released).toHaveBeenCalledOnce();
  });

  it('releases an active request when its resource is aborted', async () => {
    const response = new Subject<number>();
    const controller = new AbortController();
    const pending = apiRequest(response, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(response.observed).toBe(true);
    controller.abort();
    await rejected;
    expect(response.observed).toBe(false);
  });

  it('does not subscribe to an already aborted request', async () => {
    const subscribed = vi.fn();
    const response = new Observable<number>(subscribed);
    const controller = new AbortController();
    controller.abort();
    await expect(apiRequest(response, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(subscribed).not.toHaveBeenCalled();
  });

  it('preserves transport errors', async () => {
    const failure = new Error('Offline');
    await expect(apiRequest(throwError(() => failure))).rejects.toBe(failure);
  });
});

describe('One-shot reactive reads', () => {
  it('resolves a resource read and releases its reactive observers', async () => {
    const injector = TestBed.inject(Injector);
    const load = vi.fn((abortSignal: AbortSignal) => apiRequest(of(42), abortSignal));
    expect(await resourceRequest(injector, load)).toBe(42);
    TestBed.tick();
    expect(load).toHaveBeenCalledOnce();
  });

  it('propagates a loader failure', async () => {
    const failure = new Error('Offline');
    await expect(
      resourceRequest(TestBed.inject(Injector), () => Promise.reject(failure)),
    ).rejects.toBe(failure);
  });

  it('cancels pending reads when their owner is destroyed', async () => {
    const owner = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const response = new Subject<number>();
    const pending = resourceRequest(owner, (signal) => apiRequest(response, signal));
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    TestBed.tick();
    expect(response.observed).toBe(true);
    owner.destroy();
    await rejected;
    expect(response.observed).toBe(false);
    await expect(resourceRequest(owner, () => Promise.resolve(1))).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
