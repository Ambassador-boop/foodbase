/**
 * Push sound fields for OneSignal, entirely behind environment variables.
 *
 * Nothing here is required: with no variables set every function returns an
 * empty object, `{ ...pushSoundFields() }` adds no keys, and the payload the app
 * sends today is byte-for-byte the payload it sends after this change. A live
 * restaurant must never stop receiving orders because a sound was misconfigured.
 *
 * What is sent, and why only these two fields carry sound:
 *
 *   ios_sound            the bundled sound file NAME WITH ITS EXTENSION, e.g.
 *                        `custom_sound_1.caf`. iOS plays files compiled into the app.
 *   android_channel_id   the UUID of an Android notification channel created in the
 *                        OneSignal dashboard. On Android 8+ the sound belongs to the
 *                        channel, not to the message, so this IS the sound control.
 *
 * Deliberately not sent: `android_sound` (documented as not working on Android 8
 * and newer, and absent from the current API reference) and `sound` (not a field
 * in the notification API at all). Sending either would look like configuration
 * while doing nothing.
 *
 * Environment (all optional):
 *   ONESIGNAL_IOS_SOUND                 e.g. custom_sound_1.caf
 *   ONESIGNAL_PUSH_SOUND                fallback for ios_sound
 *   ONESIGNAL_ANDROID_CHANNEL_ID        dashboard channel UUID, unprefixed
 *   ONESIGNAL_IOS_INTERRUPTION_LEVEL    active | time_sensitive | passive | critical
 *   ONESIGNAL_IOS_BADGE_TYPE            None | SetTo | Increase
 *   ONESIGNAL_IOS_BADGE_COUNT           integer, used with the badge type
 *
 * `docs/BATCH_3C_REPORT.md` has the dashboard steps for OneSignal and for the
 * Median app, including why a native sound only ever plays inside a Median build.
 */

export type OneSignalSoundFields = {
  ios_sound?: string;
  android_channel_id?: string;
  ios_interruption_level?: string;
  ios_badgeType?: string;
  ios_badgeCount?: number;
};

/** The file we ship in `public/sounds/` for the owner to upload to Median. */
export const KITCHEN_SOUND_FILE = 'kitchen_alert';

const ALLOWED_INTERRUPTION = ['active', 'time_sensitive', 'passive', 'critical'];
const ALLOWED_BADGE = ['None', 'SetTo', 'Increase'];

function read(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/** Only the fields that are actually configured. Empty object when nothing is. */
export function pushSoundFields(): OneSignalSoundFields {
  const fields: OneSignalSoundFields = {};

  const ios = read('ONESIGNAL_IOS_SOUND') ?? read('ONESIGNAL_PUSH_SOUND');
  if (ios) fields.ios_sound = ios;

  const channel = read('ONESIGNAL_ANDROID_CHANNEL_ID');
  if (channel) fields.android_channel_id = channel;

  const interruption = read('ONESIGNAL_IOS_INTERRUPTION_LEVEL');
  if (interruption && ALLOWED_INTERRUPTION.includes(interruption)) {
    fields.ios_interruption_level = interruption;
  }

  const badgeType = read('ONESIGNAL_IOS_BADGE_TYPE');
  if (badgeType && ALLOWED_BADGE.includes(badgeType)) fields.ios_badgeType = badgeType;

  const badgeCount = Number(read('ONESIGNAL_IOS_BADGE_COUNT') ?? '');
  if (Number.isInteger(badgeCount) && badgeCount >= 0) fields.ios_badgeCount = badgeCount;

  return fields;
}

/** What the settings screen reports back. File names and ids, never secrets. */
export function describePushSoundConfig() {
  const fields = pushSoundFields();
  return {
    configured: Boolean(fields.ios_sound || fields.android_channel_id),
    iosSound: fields.ios_sound ?? null,
    androidChannelId: fields.android_channel_id ?? null,
    interruptionLevel: fields.ios_interruption_level ?? null,
    bundledFileHint: `public/sounds/${KITCHEN_SOUND_FILE}.wav`,
    androidNote:
      'Android sound lives on the notification channel: create it in the OneSignal dashboard under Settings > Push & In-App > Android Notification Channels, then set ONESIGNAL_ANDROID_CHANNEL_ID.',
    iosNote: 'iOS plays a file bundled inside the app: upload it in Median App Studio and set ONESIGNAL_IOS_SOUND to the assigned name with .caf.',
  };
}
