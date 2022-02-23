// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { ITerminal } from '@rushstack/node-core-library';

/**
 * @beta
 */
export interface IGetCacheEntryResponse {
  buffer: Buffer | undefined;
  hasNetworkError: boolean;
}

/**
 * @beta
 */
export interface ISetCacheEntryResponse {
  success: boolean;
  hasNetworkError: boolean;
}

/**
 * @beta
 */
export interface ICloudBuildCacheProvider {
  readonly isCacheWriteAllowed: boolean;

  tryGetCacheEntryBufferByIdAsync(terminal: ITerminal, cacheId: string): Promise<IGetCacheEntryResponse>;
  trySetCacheEntryBufferAsync(
    terminal: ITerminal,
    cacheId: string,
    entryBuffer: Buffer
  ): Promise<ISetCacheEntryResponse>;
  updateCachedCredentialAsync(terminal: ITerminal, credential: string): Promise<void>;
  updateCachedCredentialInteractiveAsync(terminal: ITerminal): Promise<void>;
  deleteCachedCredentialsAsync(terminal: ITerminal): Promise<void>;
}
