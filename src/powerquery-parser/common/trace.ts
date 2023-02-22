// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-require-imports
import performanceNow = require("performance-now");

// phase:
//      Static string.
//      Examples: 'Lex', 'Parse', 'StaticAnalysis'
// task:
//      Static string.
//      Something that falls under the given phase. Recommended to be the name of a function.
//      Examples: 'readNumericLiteral' for the phase 'Lex', or 'parseRecord' for the phase 'Parse'.
// id:
//      Dynamic number.
//      Used to help identify uniqueness. Auto incrementing integer.
// correlationId:
//      Can be undefined. If truthy then it refers to a previously generated 'id' number.
//      Used to track execution flow.
// message:
//      Static string.
//      Identifies what portion of a task you're in.
//      Examples: 'entry', 'partialEvaluation', 'traceExit'.
// details:
//      Nullable object that is JSON serializable.
//      Contains dynamic data, such as function arguments.
//      If null, then `[Empty]` is used instead.
//      If JSON.stringify throws an error, then `[JSON.stringify Error]` is used instead.
//
// Example where each time the tracer emits a value it'll append to the local message.
// let message = "";
// const traceManager = new TraceManager((entry: string) => (message += (entry + "\n")), "\t");
//
// function foobar(x: number): void {
//     const trace: Trace = traceManager.entry("Example", foobar.name, undefined, { x, messageLength: message.length });
//     // ...
//     trace.exit();
// }
//
// foobar(10);

// Constants used in multiple files as part of a trace's phase/task/message/details.
export const enum TraceConstant {
    CorrelationId = "CorrelationId",
    Empty = "[Empty]",
    Entry = "Entry",
    Exit = "Exit",
    IsError = "IsError",
    IsThrowing = "IsThrowing",
    Length = "Length",
    Result = "Result",
}

export class Trace {
    constructor(
        protected readonly emitter: (trace: Trace, message: string, details?: object) => void,
        public readonly phase: string,
        public readonly task: string,
        public readonly id: number,
        public readonly correlationId: number | undefined,
        details?: object,
    ) {
        this.entry(details);
    }

    public entry(details?: object): void {
        this.trace(TraceConstant.Entry, details);
    }

    public trace(message: string, details?: object): void {
        this.emitter(this, message, details);
    }

    public exit(details?: object): void {
        this.trace(TraceConstant.Exit, details);
    }
}

// Tracing entries add the current time to its details field.
export class BenchmarkTrace extends Trace {
    constructor(
        emitTraceFn: (trace: Trace, message: string, details?: object) => void,
        phase: string,
        task: string,
        id: number,
        correlationId: number | undefined,
        details?: object,
    ) {
        super(emitTraceFn, phase, task, id, correlationId, details);
    }

    public override trace(message: string, details?: object): void {
        super.trace(message, details);
    }
}

export class NoOpTrace extends Trace {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public override trace(_message: string, _details?: object): void {}
}

export const NoOpTraceInstance: NoOpTrace = new NoOpTrace(
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    (_trace: Trace, _message: string, _details?: object) => {},
    "",
    "",
    -1,
    undefined,
);

export abstract class TraceManager {
    protected readonly idFactory: () => number = createAutoIncrementIdFactory();

    constructor(protected readonly valueDelimiter: string = ",", protected readonly newline: "\n" | "\r\n" = "\r\n") {}

    abstract emit(trace: Trace, message: string, details?: object): void;

    // Creates a new Trace instance and call its entry method.
    // Traces should be created at the start of a function, and further calls are made on Trace instance.
    public entry(phase: string, task: string, correlationId: number | undefined, details?: object): Trace {
        return this.trace(phase, task, correlationId, details);
    }

    // Defaults to simple concatenation.
    protected formatMessage(trace: Trace, message: string, details?: object): string {
        const detailsJson: string = details !== undefined ? this.safeJsonStringify(details) : TraceConstant.Empty;

        return (
            [trace.phase, trace.task, trace.id, trace.correlationId, performanceNow(), message, detailsJson].join(
                this.valueDelimiter,
            ) + this.newline
        );
    }

    // The return to the TraceManager.start function.
    // Subclass this when the TraceManager needs a different subclass of Trace.
    // Eg. BenchmarkTraceManager returns a BenchmarkTrace instance.
    protected trace(phase: string, task: string, correlationId: number | undefined, details?: object): Trace {
        return new Trace(this.emit.bind(this), phase, task, this.idFactory(), correlationId, details);
    }

    // Copied signature from `JSON.stringify`.
    // Subclass this by providing values for `replacer` and/or `space`.
    protected safeJsonStringify(
        obj: object,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        replacer?: (this: any, key: string, value: any) => any,
        space?: string | number,
    ): string {
        try {
            return JSON.stringify(obj, replacer, space);
        } catch {
            return "[JSON.stringify Error]";
        }
    }
}

// Each trace entry gets passed to a callback function.
export class ReportTraceManager extends TraceManager {
    constructor(private readonly emitter: (message: string) => void, valueDelimiter: string = "\t") {
        super(valueDelimiter);
    }

    emit(trace: Trace, message: string, details?: object): void {
        this.emitter(this.formatMessage(trace, message, details));
    }
}

// See BenchmarkTrace for details.
export class BenchmarkTraceManager extends ReportTraceManager {
    constructor(outputFn: (message: string) => void, valueDelimiter: string = "\t") {
        super(outputFn, valueDelimiter);
    }

    protected override trace(
        phase: string,
        task: string,
        correlationId: number | undefined,
        details?: object,
    ): BenchmarkTrace {
        return new BenchmarkTrace(this.emit.bind(this), phase, task, this.idFactory(), correlationId, details);
    }
}

// The TraceManager for DefaultSettings.
export class NoOpTraceManager extends TraceManager {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    emit(_tracer: Trace, _message: string, _details?: object): void {}

    protected override trace(
        _phase: string,
        _task: string,
        _correlationId: number | undefined,
        _details?: object,
    ): Trace {
        return NoOpTraceInstance;
    }
}

export const NoOpTraceManagerInstance: NoOpTraceManager = new NoOpTraceManager(undefined, undefined);

function createAutoIncrementIdFactory(): () => number {
    let counter: number = 0;

    return (): number => {
        counter += 1;

        return counter;
    };
}
