// Validators for the documents bulbs exchange: wake events, outcomes and lifecycle notifications.
import wakeEventSchema from '../schemas/wake-event.schema.json' with { type: 'json' };
import outcomeSchema from '../schemas/outcome.schema.json' with { type: 'json' };
import lifecycleNotificationSchema from '../schemas/lifecycle-notification.schema.json' with { type: 'json' };
import type { WakeEvent } from '../generated/wake-event.js';
import type { Outcome } from '../generated/outcome.js';
import type { LifecycleNotification } from '../generated/lifecycle-notification.js';
import { createParser } from './validate.js';

export { wakeEventSchema, outcomeSchema, lifecycleNotificationSchema };

/** Validates a wake event and returns a clone; throws `ContractValidationError`. */
export const parseWakeEvent = createParser<WakeEvent>(wakeEventSchema, 'wake event');

/** Validates an outcome (blocked/error need `decision_needed`) and returns a clone; throws `ContractValidationError`. */
export const parseOutcome = createParser<Outcome>(outcomeSchema, 'outcome');

/** Validates a lifecycle notification and returns a clone; throws `ContractValidationError`. */
export const parseLifecycleNotification = createParser<LifecycleNotification>(
  lifecycleNotificationSchema,
  'lifecycle notification',
);
