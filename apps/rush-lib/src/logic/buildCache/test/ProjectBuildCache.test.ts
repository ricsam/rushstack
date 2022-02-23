// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import {
  ConsoleTerminalProvider,
  ITerminal,
  StringBufferTerminalProvider,
  Terminal
} from '@rushstack/node-core-library';
import { BuildCacheConfiguration, IRetryCacheRequest } from '../../../api/BuildCacheConfiguration';
import { RushProjectConfiguration } from '../../../api/RushProjectConfiguration';
import { ProjectChangeAnalyzer } from '../../ProjectChangeAnalyzer';
import { IGenerateCacheEntryIdOptions } from '../CacheEntryId';
import { FileSystemBuildCacheProvider } from '../FileSystemBuildCacheProvider';
import { IGetCacheEntryResponse, ICloudBuildCacheProvider } from '../ICloudBuildCacheProvider';

import { ProjectBuildCache } from '../ProjectBuildCache';

interface ITestOptions {
  enabled: boolean;
  writeAllowed: boolean;
  trackedProjectFiles: string[] | undefined;
  tryGetCacheEntryBufferByIdAsync: ICloudBuildCacheProvider['tryGetCacheEntryBufferByIdAsync'];
  localCacheProvider: FileSystemBuildCacheProvider;
  retryCacheRequest: IRetryCacheRequest;
}

describe(ProjectBuildCache.name, () => {
  async function prepareSubject(options: Partial<ITestOptions>): Promise<ProjectBuildCache | undefined> {
    const terminal: Terminal = new Terminal(new StringBufferTerminalProvider());
    const projectChangeAnalyzer = {
      [ProjectChangeAnalyzer.prototype._tryGetProjectStateHashAsync.name]: async () => {
        return 'state_hash';
      }
    } as unknown as ProjectChangeAnalyzer;

    const subject: ProjectBuildCache | undefined = await ProjectBuildCache.tryGetProjectBuildCache({
      buildCacheConfiguration: {
        buildCacheEnabled: options.hasOwnProperty('enabled') ? options.enabled : true,
        getCacheEntryId: (options: IGenerateCacheEntryIdOptions) =>
          `${options.projectName}/${options.projectStateHash}`,
        localCacheProvider: options.hasOwnProperty('localCacheProvider')
          ? options.localCacheProvider
          : undefined,
        cloudCacheProvider: {
          isCacheWriteAllowed: options.hasOwnProperty('writeAllowed') ? options.writeAllowed : false,
          tryGetCacheEntryBufferByIdAsync: options.hasOwnProperty('tryGetCacheEntryBufferByIdAsync')
            ? options.tryGetCacheEntryBufferByIdAsync
            : undefined
        },
        retryCacheRequest: options.hasOwnProperty('retryCacheRequest') ? options.retryCacheRequest : undefined
      } as unknown as BuildCacheConfiguration,
      projectOutputFolderNames: ['dist'],
      projectConfiguration: {
        project: {
          packageName: 'acme-wizard',
          projectRelativeFolder: 'apps/acme-wizard',
          dependencyProjects: []
        }
      } as unknown as RushProjectConfiguration,
      command: 'build',
      trackedProjectFiles: options.hasOwnProperty('trackedProjectFiles') ? options.trackedProjectFiles : [],
      projectChangeAnalyzer,
      terminal,
      phaseName: 'build'
    });

    return subject;
  }

  describe(ProjectBuildCache.tryGetProjectBuildCache.name, () => {
    it('returns a ProjectBuildCache with a calculated cacheId value', async () => {
      const subject: ProjectBuildCache = (await prepareSubject({}))!;
      expect(subject['_cacheId']).toMatchInlineSnapshot(
        `"acme-wizard/1926f30e8ed24cb47be89aea39e7efd70fcda075"`
      );
    });

    it('returns undefined if the tracked file list is undefined', async () => {
      expect(
        await prepareSubject({
          trackedProjectFiles: undefined
        })
      ).toBe(undefined);
    });

    it('should retry request if retryCacheRequest is specified', async () => {
      const subject = await prepareSubject({
        localCacheProvider: {
          tryGetCacheEntryPathByIdAsync: () => {
            return undefined;
          }
        } as unknown as FileSystemBuildCacheProvider,
        tryGetCacheEntryBufferByIdAsync: async (terminal, cacheId): Promise<IGetCacheEntryResponse> => {
          return {
            buffer: undefined,
            hasNetworkError: true
          };
        },
        retryCacheRequest: {
          retries: 2,
          exponential: true,
          waitDuration: 2
        }
      });
      const terminal: ITerminal = new Terminal(
        new ConsoleTerminalProvider({
          verboseEnabled: true,
          debugEnabled: true
        })
      );

      if (!subject) {
        throw new Error('invalid code');
      }

      const _st = global.setTimeout;
      global.setTimeout = ((callback: () => void, time: number) => {
        return _st(callback, 1);
      }).bind(global) as typeof global.setTimeout;

      jest.spyOn(global, 'setTimeout');

      const result = await subject.tryRestoreFromCacheAsync(terminal);
      expect(setTimeout).toHaveBeenCalledTimes(2);
      expect(setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 2000);
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 4000);
      expect(result).toBe(false);
    }, 10000);
  });
});
