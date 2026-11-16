import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, firstValueFrom } from 'rxjs';

/** Awaits one API reply, unsubscribing the request if its owner is destroyed first. */
export function apiRequest<T>(response: Observable<T>, destroyRef: DestroyRef): Promise<T> {
  return firstValueFrom(response.pipe(takeUntilDestroyed(destroyRef)));
}
