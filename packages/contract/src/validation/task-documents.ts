// Validators for persisted task state and responsibility scope declarations.
import taskStateSchema from '../schemas/task-state.schema.json' with { type: 'json' };
import responsibilityScopeSchema from '../schemas/responsibility-scope.schema.json' with { type: 'json' };
import type { TaskState } from '../generated/task-state.js';
import type { ResponsibilityScope } from '../generated/responsibility-scope.js';
import { createParser } from './validate.js';

export { taskStateSchema, responsibilityScopeSchema };

/** Validates task state (waiting needs `deadline`) and returns a clone; throws `ContractValidationError`. */
export const parseTaskState = createParser<TaskState>(taskStateSchema, 'task state');

/** Validates a responsibility scope declaration and returns a clone; throws `ContractValidationError`. */
export const parseResponsibilityScope = createParser<ResponsibilityScope>(
  responsibilityScopeSchema,
  'responsibility scope',
);
