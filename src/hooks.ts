import type { Transport } from '@sveltejs/kit';
import { RecordId } from 'surrealdb';

export const transport: Transport = {
	RecordId: {
		encode: (value) => value instanceof RecordId && [value.table.name, value.id],
		decode: ([table, id]) => new RecordId(table as string, id as number | string)
	}
};
