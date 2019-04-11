import { Localization } from "../localization/error";
import { Option } from "./option";

export namespace CommonError {

    export type TInnerCommonError = (
        | InvariantError
        | NotYetImplementedError
        | UnknownError
    )

    export class CommonError extends Error {
        constructor(
            readonly innerError: TInnerCommonError,
        ) {
            super(innerError.message);
        }
    }

    export class InvariantError extends Error {
        constructor(
            readonly invariantBroken: string,
            readonly maybeDetails: Option<any> = undefined,
        ) {
            super(Localization.Error.invariantError(invariantBroken, maybeDetails));
        }
    }

    export class NotYetImplementedError extends Error {
        constructor(
            readonly reason: string,
            readonly maybeDetails: Option<any> = undefined,
        ) {
            super(Localization.Error.notYetImplemented(reason, maybeDetails));
        }
    }

    export class UnknownError extends Error {
        constructor(
            readonly innerError: any,
        ) {
            super(Localization.Error.unknownError(innerError));
        }
    }

    export function isTInnerCommonError(x: any): x is TInnerCommonError {
        return (
            x instanceof InvariantError
            || x instanceof NotYetImplementedError
            || x instanceof UnknownError
        );
    }

    export function ensureWrappedError(err: Error): CommonError {
        if (isTInnerCommonError(err)) {
            return new CommonError(err);
        }
        else {
            return new CommonError(new UnknownError(err));
        }
    }
}
