export interface DriveFolderItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  createdTime?: string;
  size?: string;
}

export async function connectGoogleDrive(): Promise<{ user: any; accessToken: string }> {
  throw new Error('El acceso se realiza mediante carga directa de fotos y archivos para permitir el acceso público sin restricciones de cuentas.');
}

export function getDriveAccessToken(): string | null {
  return null;
}

export function getDriveUser(): any | null {
  return null;
}

export function disconnectGoogleDrive(): void {}

export async function listDriveFolders(_token?: string): Promise<DriveFolderItem[]> {
  return [];
}

export async function createDriveFolder(_folderName?: string, _parentId?: string, _token?: string): Promise<DriveFolderItem> {
  return { id: 'folder_' + Date.now(), name: _folderName || 'Remitos' };
}

export async function listScannedFilesInFolder(_folderId?: string, _token?: string): Promise<DriveFileItem[]> {
  return [];
}

export async function downloadDriveFileAsBase64(_fileId?: string, _token?: string): Promise<{ base64Data: string; mimeType: string }> {
  return { base64Data: '', mimeType: 'image/jpeg' };
}

export async function moveDriveFile(_fileId?: string, _sourceFolderId?: string, _targetFolderId?: string, _token?: string): Promise<void> {}
