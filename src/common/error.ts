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
            readonly maybeJsonfyable: Option<any> = undefined,
            readonly message = Localization.Error.invariantError(invariantBroken, maybeJsonfyable),
        ) {
            super(message);
        }
    }

    export class NotYetImplementedError extends Error {
        constructor(
            readonly reason: string,
            readonly maybeJsonfyable: Option<any> = undefined,
            readonly message = Localization.Error.notYetImplemented(reason, maybeJsonfyable),
        ) {
            super(message);
        }
    }

    export class UnknownError extends Error {
        constructor(
            readonly innerError: any,
            readonly message = Localization.Error.unknownError(innerError),
        ) {
            super(message);
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
