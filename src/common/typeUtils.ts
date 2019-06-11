// removes `readonly` from T's attributes
export type Writable<T> = { -readonly [K in keyof T]: T[K] };
