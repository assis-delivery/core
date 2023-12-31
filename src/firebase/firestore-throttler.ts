import { Inject, Injectable } from '@nestjs/common';
import { FirebaseFunctionsRateLimiter } from 'firebase-functions-rate-limiter';

import { safeAsync } from '../common/safe.js';
import { TOO_MANY_REQUESTS } from '../core/exception/core-exceptions.js';
import { Throttler } from '../core/throttler/throttler.js';
import { ThrottlerOptionsArgs } from '../core/throttler/throttler.type.js';

import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';
import { FirebaseFunctionsRateLimiterToken } from './firebase-functions-rate-limiter.token.js';

export const FirestoreThrottlerCollectionNameToken =
  'FirestoreThrottlerCollectionNameToken';

@Injectable()
export class FirestoreThrottler extends Throttler {
  constructor(
    private readonly firebaseAdminFirestore: FirebaseAdminFirestore,
    @Inject(FirestoreThrottlerCollectionNameToken)
    private readonly collectionName: string,
    @Inject(FirebaseFunctionsRateLimiterToken)
    private readonly firebaseFunctionsRateLimiter: typeof FirebaseFunctionsRateLimiter,
  ) {
    super();
  }

  async rejectOnQuotaExceededOrRecordUsage({
    context,
    ttl,
    limit,
  }: ThrottlerOptionsArgs): Promise<void> {
    const rateLimiter = this.firebaseFunctionsRateLimiter.withFirestoreBackend(
      {
        name: this.collectionName,
        maxCalls: limit,
        periodSeconds: ttl,
      },
      this.firebaseAdminFirestore,
    );
    const prefix = `${context.getClass().name}-${context.getHandler().name}`;
    const [error] = await safeAsync(() =>
      rateLimiter.rejectOnQuotaExceededOrRecordUsage(
        `${prefix}-${context.switchToHttp().getRequest().ip}`,
      ),
    );
    if (error) {
      throw TOO_MANY_REQUESTS();
    }
  }
}
