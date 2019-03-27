import { CommonError } from "./error";

export function isNever(_: never): never {
    throw new CommonError.InvariantError("should never be reached");
}
