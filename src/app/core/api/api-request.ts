import { Observable, firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { DestroyRef, EffectRef, Injector, ResourceRef, effect, resource } from '@angular/core';

if (!Symbol.dispose) Object.defineProperty(Symbol, 'dispose', { value: Symbol('Symbol.dispose') });

class RequestLifetime implements Disposable {
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private readonly cancel = () => this.controller.abort();

  constructor(private readonly parent?: AbortSignal) {
    if (parent?.aborted) this.cancel();
    else parent?.addEventListener('abort', this.cancel, { once: true });
  }

  [Symbol.dispose](): void {
    this.parent?.removeEventListener('abort', this.cancel);
    this.cancel();
  }
}

/** The only Observable-to-Promise boundary; cancellation unsubscribes Angular HTTP requests. */
export async function apiRequest<T>(
  response: Observable<T>,
  abortSignal?: AbortSignal,
): Promise<T> {
  using request = new RequestLifetime(abortSignal);
  if (request.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
  try {
    return await firstValueFrom(response.pipe(takeUntil(fromEvent(request.signal, 'abort'))));
  } catch (error: unknown) {
    if (request.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
    throw error;
  }
}

class ReactiveRequest<T> implements Disposable {
  readonly completion = Promise.withResolvers<T>();
  private readonly read: ResourceRef<T | undefined>;
  private readonly watcher: EffectRef;
  private readonly unregister: () => void;

  constructor(injector: Injector, load: (abortSignal: AbortSignal) => Promise<T>) {
    this.read = resource({ injector, loader: ({ abortSignal }) => load(abortSignal) });
    this.watcher = effect(
      () => {
        if (this.read.isLoading()) return;
        if (this.read.error()) {
          this.completion.reject(this.read.error());
          return;
        }
        if (this.read.hasValue()) this.completion.resolve(this.read.value());
        else if (this.read.status() === 'resolved')
          this.completion.reject(new Error('Empty response'));
      },
      { injector, manualCleanup: true },
    );
    this.unregister = injector
      .get(DestroyRef)
      .onDestroy(() => this.completion.reject(new DOMException('Request cancelled', 'AbortError')));
  }

  [Symbol.dispose](): void {
    this.watcher.destroy();
    this.read.destroy();
    this.unregister();
  }
}

export async function resourceRequest<T>(
  injector: Injector,
  load: (abortSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (
    ('destroyed' in injector && injector.destroyed === true) ||
    injector.get(DestroyRef).destroyed
  )
    throw new DOMException('Request cancelled', 'AbortError');
  using request = new ReactiveRequest(injector, load);
  return await request.completion.promise;
}
