import { eq, and } from 'drizzle-orm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import type { Database } from '../db/index.js';
import { credentials } from '../db/schema.js';
import { users } from '../db/schema.js';
import { config } from '../config.js';

export class PasskeyService {
  constructor(private db: Database) {}

  async getCredentialsByUserId(userId: string) {
    return this.db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, userId));
  }

  async getCredentialById(credentialId: string) {
    const [cred] = await this.db
      .select()
      .from(credentials)
      .where(eq(credentials.id, credentialId))
      .limit(1);
    return cred ?? null;
  }

  async generateRegOptions(user: { id: string; email: string; username: string }) {
    const existingCreds = await this.getCredentialsByUserId(user.id);

    const options = await generateRegistrationOptions({
      rpName: config.rp.name,
      rpID: config.rp.id,
      userName: user.email,
      userDisplayName: user.username,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c) => ({
        id: c.id,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    return options;
  }

  async verifyAndSaveRegistration(
    userId: string,
    expectedChallenge: string,
    response: RegistrationResponseJSON,
  ) {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.rp.origin,
      expectedRPID: config.rp.id,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return false;
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    await this.db.insert(credentials).values({
      id: credential.id,
      userId,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports ?? null,
      createdAt: new Date(),
    });

    return true;
  }

  async generateAuthOptions() {
    const options = await generateAuthenticationOptions({
      rpID: config.rp.id,
      userVerification: 'preferred',
    });

    return options;
  }

  async verifyAuthentication(
    expectedChallenge: string,
    response: AuthenticationResponseJSON,
  ) {
    const cred = await this.getCredentialById(response.id);
    if (!cred) return null;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.rp.origin,
      expectedRPID: [config.rp.id],
      credential: {
        id: cred.id,
        publicKey: cred.publicKey,
        counter: cred.counter,
        transports: cred.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) return null;

    // Update counter
    await this.db
      .update(credentials)
      .set({
        counter: verification.authenticationInfo.newCounter,
        backedUp: verification.authenticationInfo.credentialBackedUp,
      })
      .where(eq(credentials.id, cred.id));

    // Look up the user
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, cred.userId))
      .limit(1);

    return user ?? null;
  }

  async deleteCredential(credentialId: string, userId: string) {
    const result = await this.db
      .delete(credentials)
      .where(
        and(eq(credentials.id, credentialId), eq(credentials.userId, userId)),
      );
    return result.changes > 0;
  }
}
