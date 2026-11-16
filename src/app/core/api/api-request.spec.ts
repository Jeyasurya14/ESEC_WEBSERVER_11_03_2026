import { DestroyRef, EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-request';

describe('apiRequest', () => {
  function owner() {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    return { injector, destroyRef: injector.get(DestroyRef) };
  }

  it('resolves with the first reply and then unsubscribes', async () => {
    const released = vi.fn();
    const response = new Observable<number>((subscriber) => {
      subscriber.next(42);
      return released;
    });

    expect(await apiRequest(response, owner().destroyRef)).toBe(42);
    expect(released).toHaveBeenCalledOnce();
  });

  it('cancels the request when its owner is destroyed first', async () => {
    const { injector, destroyRef } = owner();
    const response = new Subject<number>();
    const pending = apiRequest(response, destroyRef);
    const rejected = expect(pending).rejects.toBeDefined();

    expect(response.observed).toBe(true);
    injector.destroy();

    await rejected;
    expect(response.observed).toBe(false);
  });

  it('preserves transport errors', async () => {
    const failure = new Error('Offline');
    await expect(
      apiRequest(
        throwError(() => failure),
        owner().destroyRef,
      ),
    ).rejects.toBe(failure);
  });
});
