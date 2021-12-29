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
//      Dynamic string.
//      Used to guarantee uniqueness, defaults to an auto incrementing integer.
//      If we ever run into an integer overflow issue then we could look into a GUID generating library.
// message:
//      Static string.
//      Identifies what portion of a task you're in.
//      Examples: 'entry', 'partialEvaluation', 'traceExit'.
// maybeDetails:
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
//     const trace: Trace = traceManager.entry("Example", foobar.name, { x, messageLength: message.length });
//     // ...
//     trace.exit();
// }
//
// foobar(10);

// Constants used in multiple files as part of a trace's phase/task/message/details.
export const enum TraceConstant {
    Empty = "[Empty]",
    Entry = "Entry",
    Exit = "Exit",
    IsError = "IsError",
    IsThrowing = "IsThrowing",
    Length = "Length",
    Result = "Result",
    TimeDelta = "TimeDelta",
    TimeEnd = "TimeEnd",
    TimeNow = "TimeNow",
    TimeStart = "TimeStart",
}

export abstract class TraceManager {
    protected readonly createIdFn: () => string = createAutoIncrementId();

    constructor(protected readonly valueDelimiter: string = ",", protected readonly newline: "\n" | "\r\n" = "\r\n") {}

    abstract emit(trace: Trace, message: string, maybeDetails?: object): void;

    // Creates a new Trace instance and call its entry method.
    // Traces should be created at the start of a function, and further calls are made on Trace instance.
    public entry(phase: string, task: string, maybeDetails?: object): Trace {
        return this.create(phase, task, maybeDetails);
    }

    // Defaults to simple concatenation.
    protected formatMessage(trace: Trace, message: string, maybeDetails?: object): string {
        const details: string = maybeDetails !== undefined ? this.safeJsonStringify(maybeDetails) : TraceConstant.Empty;

        return [trace.phase, trace.task, trace.id, message, details].join(this.valueDelimiter) + this.newline;
    }

    // The return to the TraceManager.start function.
    // Subclass this when the TraceManager needs a different subclass of Trace.
    // Eg. BenchmarkTraceManager returns a BenchmarkTrace instance.
    protected create(phase: string, task: string, maybeDetails?: object): Trace {
        return new Trace(this.emit.bind(this), phase, task, this.createIdFn(), maybeDetails);
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
        } catch (e) {
            return "[JSON.stringify Error]";
        }
    }
}

// Each trace entry gets passed to a callback function.
export class ReportTraceManager extends TraceManager {
    constructor(private readonly outputFn: (message: string) => void, valueDelimiter: string = "\t") {
        super(valueDelimiter);
    }

    emit(trace: Trace, message: string, maybeDetails?: object): void {
        this.outputFn(this.formatMessage(trace, message, maybeDetails));
    }
}

// See BenchmarkTrace for details.
export class BenchmarkTraceManager extends ReportTraceManager {
    constructor(outputFn: (message: string) => void, valueDelimiter: string = "\t") {
        super(outputFn, valueDelimiter);
    }

    protected override create(phase: string, task: string, maybeDetails?: object): BenchmarkTrace {
        return new BenchmarkTrace(this.emit.bind(this), phase, task, this.createIdFn(), maybeDetails);
    }
}

// The TraceManager for DefaultSettings.
export class NoOpTraceManager extends TraceManager {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    emit(_tracer: Trace, _message: string, _maybeDetails?: object): void {}

    protected override create(phase: string, task: string, maybeDetails?: object): Trace {
        return new NoOpTrace(this.emit.bind(this), phase, task, this.createIdFn(), maybeDetails);
    }
}

export class Trace {
    constructor(
        protected readonly emitTraceFn: (trace: Trace, message: string, maybeDetails?: object) => void,
        public readonly phase: string,
        public readonly task: string,
        public readonly id: string,
        maybeDetails?: object,
    ) {
        this.entry(maybeDetails);
    }

    public entry(maybeDetails?: object): void {
        this.trace(TraceConstant.Entry, maybeDetails);
    }

    public trace(message: string, maybeDetails?: object) {
        this.emitTraceFn(this, message, maybeDetails);
    }

    public exit(maybeDetails?: object): void {
        this.trace(TraceConstant.Exit, maybeDetails);
    }
}

// Tracing entries add the current time to its details field,
// and calculates the duration between the BenchmarkTrace's creation and now.
export class BenchmarkTrace extends Trace {
    protected readonly timeStart: number = performanceNow();

    constructor(
        emitTraceFn: (trace: Trace, message: string, maybeDetails?: object) => void,
        phase: string,
        task: string,
        id: string,
        maybeDetails?: object,
    ) {
        super(emitTraceFn, phase, task, id, maybeDetails);
    }

    public override trace(message: string, maybeDetails?: object) {
        const timeNow: number = performanceNow();

        super.trace(message, {
            ...maybeDetails,
            [TraceConstant.TimeNow]: timeNow,
            [TraceConstant.TimeDelta]: timeNow - this.timeStart,
        });
    }
}

export class NoOpTrace extends Trace {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public override trace(_message: string, _maybeDetails?: object) {}
}

function createAutoIncrementId(): () => string {
    let counter: number = 0;

    return () => {
        counter += 1;
        return counter.toString();
    };
}
