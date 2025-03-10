// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { Operation } from '../Operation';
import { OperationStatus } from '../OperationStatus';
import { MockOperationRunner } from './MockOperationRunner';
import { AsyncOperationQueue, IOperationSortFunction } from '../AsyncOperationQueue';

function addDependency(dependent: Operation, dependency: Operation): void {
  dependent.dependencies.add(dependency);
}

function nullSort(a: Operation, b: Operation): number {
  return 0;
}

describe(AsyncOperationQueue.name, () => {
  it('iterates operations in topological order', async () => {
    const operations = [
      new Operation(new MockOperationRunner('a')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('b')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('c')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('d')!, OperationStatus.Ready)
    ];

    addDependency(operations[0], operations[2]);
    addDependency(operations[3], operations[1]);
    addDependency(operations[1], operations[0]);

    const expectedOrder = [operations[2], operations[0], operations[1], operations[3]];
    const actualOrder = [];
    const queue: AsyncOperationQueue = new AsyncOperationQueue(operations, nullSort);
    for await (const operation of queue) {
      actualOrder.push(operation);
      for (const dependent of operation.dependents) {
        dependent.dependencies.delete(operation);
      }
    }

    expect(actualOrder).toEqual(expectedOrder);
  });

  it('respects the sort predicate', async () => {
    const operations = [
      new Operation(new MockOperationRunner('a')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('b')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('c')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('d')!, OperationStatus.Ready)
    ];

    const expectedOrder = [operations[2], operations[0], operations[1], operations[3]];
    const actualOrder = [];
    const customSort: IOperationSortFunction = (a: Operation, b: Operation): number => {
      return expectedOrder.indexOf(b) - expectedOrder.indexOf(a);
    };

    const queue: AsyncOperationQueue = new AsyncOperationQueue(operations, customSort);
    for await (const operation of queue) {
      actualOrder.push(operation);
      for (const dependent of operation.dependents) {
        dependent.dependencies.delete(operation);
      }
    }

    expect(actualOrder).toEqual(expectedOrder);
  });

  it('detects cyles', async () => {
    const operations = [
      new Operation(new MockOperationRunner('a')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('b')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('c')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('d')!, OperationStatus.Ready)
    ];

    addDependency(operations[0], operations[2]);
    addDependency(operations[2], operations[3]);
    addDependency(operations[3], operations[1]);
    addDependency(operations[1], operations[0]);

    expect(() => {
      new AsyncOperationQueue(operations, nullSort);
    }).toThrowErrorMatchingSnapshot();
  });

  it('handles concurrent iteration', async () => {
    const operations = [
      new Operation(new MockOperationRunner('a')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('b')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('c')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('d')!, OperationStatus.Ready),
      new Operation(new MockOperationRunner('e')!, OperationStatus.Ready)
    ];

    // Set up to allow (0,1) -> (2) -> (3,4)
    addDependency(operations[2], operations[0]);
    addDependency(operations[2], operations[1]);
    addDependency(operations[3], operations[2]);
    addDependency(operations[4], operations[2]);

    const expectedConcurrency = new Map([
      [operations[0], 2],
      [operations[1], 2],
      [operations[2], 1],
      [operations[3], 2],
      [operations[4], 2]
    ]);

    const actualConcurrency: Map<Operation, number> = new Map();
    const queue: AsyncOperationQueue = new AsyncOperationQueue(operations, nullSort);
    let concurrency: number = 0;

    // Use 3 concurrent iterators to verify that it handles having more than the operation concurrency
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        for await (const operation of queue) {
          ++concurrency;
          await Promise.resolve();

          actualConcurrency.set(operation, concurrency);

          await Promise.resolve();

          for (const dependent of operation.dependents) {
            dependent.dependencies.delete(operation);
          }

          --concurrency;
        }
      })
    );

    for (const [operation, operationConcurrency] of expectedConcurrency) {
      expect(actualConcurrency.get(operation)).toEqual(operationConcurrency);
    }
  });
});
