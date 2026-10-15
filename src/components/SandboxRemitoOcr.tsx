import React, { useState, useRef, useMemo, useEffect } from 'react';
import { getCurrentIdToken } from '../services/authService';
import {
  Sparkles,
  Upload,
  FileText,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Users,
  Wrench,
  Car,
  Table2,
  FileCheck2,
  Camera,
  Loader2,
  Folder,
  FolderPlus,
  HardDrive,
  ExternalLink,
  Check,
  ArrowDown,
  FileDown,
  Cloud,
  LogOut
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { TeamMemberAssigned, TechnicalAuditRecord, GuardiaType } from '../types';
import { calculateAuditCosts, formatCurrency, roundCurrency } from '../utils/calculationUtils';
import {
  connectGoogleDrive,
  getDriveAccessToken,
  getDriveUser,
  disconnectGoogleDrive,
  listDriveFolders,
  createDriveFolder,
  listScannedFilesInFolder,
  downloadDriveFileAsBase64,
  moveDriveFile,
  DriveFolderItem,
  DriveFileItem
} from '../services/googleDriveService';

interface ExtractedRemitoData {
  remitoPapel?: string;
  fecha?: string;
  cliente?: string;
  ubicacion?: string;
  puntoTrabajo?: string;
  descripcion?: string;
  horaEntrada?: string;
  horaSalida?: string;
  horasTrabajadas?: number;
  kilometros?: number;
  viajes?: number;
  esGuardia?: boolean;
  tecnicoLider?: string;
  cuadrilla?: Array<{ nombre: string; rol?: string }>;
  materiales?: Array<{ descripcion: string; cantidad?: number }>;
  observaciones?: string;
  confianzaLectura?: number;
}

interface SandboxRemitoOcrProps {
  onSaveToSandbox: (record: TechnicalAuditRecord) => void;
  nextRemitoNumber: number;
}

export const SandboxRemitoOcr: React.FC<SandboxRemitoOcrProps> = ({
  onSaveToSandbox,
  nextRemitoNumber
}) => {
  const { clients, workers, technicalParameters } = useData();
  const { currentUser, users } = useAuth();

  // Image states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scanning & AI state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanConfidence, setScanConfidence] = useState<number | null>(null);
  const [rawAiNotes, setRawAiNotes] = useState<string | null>(null);

  // Form states populated by AI (and user editable)
  const [remitoPapel, setRemitoPapel] = useState<string>('');
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cliente, setCliente] = useState<string>('');
  const [ubicacion, setUbicacion] = useState<string>('');
  const [puntoTrabajo, setPuntoTrabajo] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [horaEntrada, setHoraEntrada] = useState<string>('08:00');
  const [horaSalida, setHoraSalida] = useState<string>('12:30');
  const [horasTrabajadas, setHorasTrabajadas] = useState<number>(4.5);
  const [kilometros, setKilometros] = useState<number>(35);
  const [viajes, setViajes] = useState<number>(1);
  const [isGuardia, setIsGuardia] = useState<boolean>(false);
  const [tecnicoLider, setTecnicoLider] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberAssigned[]>([]);
  const [materialCostEstimated, setMaterialCostEstimated] = useState<number>(0);
  const [detectedMaterialsList, setDetectedMaterialsList] = useState<Array<{ descripcion: string; cantidad?: number }>>([]);

  // Cuadrilla management
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<'Oficial' | 'Ayudante'>('Ayudante');

  // Google Drive Integration States
  const [driveToken, setDriveToken] = useState<string | null>(() => getDriveAccessToken());
  const [driveUser, setDriveUser] = useState<any>(() => getDriveUser());
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);
  const [driveFolders, setDriveFolders] = useState<DriveFolderItem[]>([]);
  const [selectedDriveFolderId, setSelectedDriveFolderId] = useState<string>(() => {
    return localStorage.getItem('job_martin_bandiera_drive_folder_id') || '';
  });
  const [selectedDriveFolderName, setSelectedDriveFolderName] = useState<string>('');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState<string>('Remitos Pendientes');
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [currentSelectedDriveFile, setCurrentSelectedDriveFile] = useState<DriveFileItem | null>(null);
  const [moveAfterProcess, setMoveAfterProcess] = useState<boolean>(true);
  const [sourceMode, setSourceMode] = useState<'drive' | 'local' | 'ejemplo'>('drive');

  // Available client names for matching hints
  const clientNamesList = useMemo(() => clients.map(c => c.razonSocial), [clients]);
  // Available worker names
  const workerNamesList = useMemo(() => {
    const list = workers.map(w => w.name);
    users.forEach(u => {
      if (u.displayName && !list.includes(u.displayName)) {
        list.push(u.displayName);
      }
    });
    return list;
  }, [workers, users]);

  // Handle image upload from file or camera
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setImageRotation(0);
      setImageZoom(1);
      setScanError(null);
    };
    reader.readAsDataURL(file);
  };

  // Generate a realistic sample handwritten remito image on HTML5 canvas for instant testing
  const handleLoadSampleRemito = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background paper texture (warm aged paper)
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Talonario header border (carbon paper / printed form look)
    ctx.strokeStyle = '#2b394a';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, 1120, 1520);

    // Printed template header
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('JOB MARTIN BANDIERA - INGENIERÍA & MANTENIMIENTO', 60, 90);

    ctx.font = '18px sans-serif';
    ctx.fillText('Servicios Electromecánicos, Tableros, Bombas y Obras Industriales', 60, 125);
    ctx.fillText('Tel: (0261) 456-7890 | Mendoza, Argentina', 60, 150);

    // Box for Remito number
    ctx.strokeRect(820, 60, 320, 100);
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('REMITO DE TRABAJO', 840, 95);
    ctx.font = 'bold 30px monospace';
    ctx.fillText('Nº 0001-0004523', 840, 140);

    // Separator line
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 180);
    ctx.lineTo(1140, 180);
    ctx.stroke();

    // Form fields (Printed labels)
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('FECHA:', 60, 230);
    ctx.fillText('CLIENTE / EMPRESA:', 60, 280);
    ctx.fillText('UBICACIÓN / FINCA:', 60, 330);
    ctx.fillText('PUNTO DE TRABAJO:', 60, 380);
    ctx.fillText('HORA LLEGADA:', 60, 430);
    ctx.fillText('HORA SALIDA:', 400, 430);
    ctx.fillText('TOTAL HORAS:', 750, 430);
    ctx.fillText('KM RECORRIDOS:', 60, 480);
    ctx.fillText('VIAJES:', 400, 480);
    ctx.fillText('¿GUARDIA / URGENCIA?:', 750, 480);

    // Grid for printed form
    ctx.strokeRect(60, 520, 1080, 420);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('DETALLE DE TAREAS Y TRABAJOS REALIZADOS:', 80, 555);

    ctx.strokeRect(60, 960, 1080, 260);
    ctx.fillText('MATERIALES Y REPUESTOS UTILIZADOS:', 80, 995);

    ctx.strokeRect(60, 1240, 1080, 280);
    ctx.fillText('PERSONAL INTERVINIENTE (CUADRILLA):', 80, 1275);
    ctx.fillText('FIRMA Y ACLARACIÓN TÉCNICO:', 80, 1470);
    ctx.fillText('CONFORME CLIENTE:', 650, 1470);

    // Now draw SIMULATED HANDWRITTEN BLUE BALLPOINT PEN TEXT
    ctx.fillStyle = '#1e3a8a'; // Blue ink
    ctx.font = 'italic 26px "Caveat", "Segoe Print", "Comic Sans MS", cursive, sans-serif';

    // Handwritten values
    ctx.fillText('24 / 09 / 2026', 160, 230);
    ctx.fillText('BODEGA & FINCA LA CONSULTA S.A.', 260, 280);
    ctx.fillText('Valle de Uco - San Carlos, Ruta 40 km 82', 260, 330);
    ctx.fillText('Pozo Nº 4 - Tablero Principal de Fuerza', 260, 380);

    ctx.fillText('08:00 hs', 220, 430);
    ctx.fillText('12:30 hs', 540, 430);
    ctx.fillText('4.5 hs', 900, 430);

    ctx.fillText('45 KM', 240, 480);
    ctx.fillText('1 VIAJE', 490, 480);
    ctx.fillText('NO (Servicio programado)', 970, 480);

    // Detailed handwriting description
    ctx.fillText('- Se realiza inspección general por falla en arranque de electrobomba sumergible pozo 4.', 80, 610);
    ctx.fillText('- Desarme y revisión de contactor principal Siemens 32A que presentaba bobina quemada.', 80, 660);
    ctx.fillText('- Se sustituye contactor y relevo térmico regulado a 22A.', 80, 710);
    ctx.fillText('- Medición de aislación en motor y chequeo de secuencia de fases R-S-T (OK 380V).', 80, 760);
    ctx.fillText('- Prueba de marcha continua durante 40 min con caudal normal sin recalentamiento.', 80, 810);
    ctx.fillText('- Equipo queda operativo en modo automático con protección térmica calibrada.', 80, 860);

    // Materials handwritten
    ctx.fillText('1) Contactor Siemens 32A 220V - Cant: 1 unid.', 80, 1050);
    ctx.fillText('2) Relevo térmico regulable 18-25A - Cant: 1 unid.', 80, 1100);
    ctx.fillText('3) Terminales de compresión 6mm y cinta aisladora autofundente - Cant: 1 kit.', 80, 1150);

    // Cuadrilla handwritten
    ctx.fillText('1. Carlos Gómez (Oficial Electromecánico a cargo)', 80, 1330);
    ctx.fillText('2. Marcelo Quinteros (Ayudante)', 80, 1370);
    ctx.fillText('3. Juan Pérez (Ayudante de cuadrilla)', 80, 1410);

    ctx.fillText('Carlos Gómez (Oficial)', 360, 1470);
    ctx.fillText('Ing. Roberto Rossi (Adm. Finca)', 830, 1470);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setSelectedImage(dataUrl);
    setImageMimeType('image/jpeg');
    setImageRotation(0);
    setImageZoom(1);
    setScanError(null);
  };

  // Initialize Google Drive folders if token exists on mount or update
  useEffect(() => {
    if (driveToken) {
      loadDriveFolders(driveToken);
    }
  }, [driveToken]);

  // Connect to Google Drive via Google OAuth popup
  const handleConnectGoogleDrive = async () => {
    setIsConnectingDrive(true);
    setScanError(null);
    try {
      const { user, accessToken } = await connectGoogleDrive();
      setDriveToken(accessToken);
      setDriveUser(user);
      await loadDriveFolders(accessToken);
    } catch (err: any) {
      console.error('Error connecting Google Drive:', err);
      setScanError(err?.message || 'Error al conectar con Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    disconnectGoogleDrive();
    setDriveToken(null);
    setDriveUser(null);
    setDriveFolders([]);
    setDriveFiles([]);
    setCurrentSelectedDriveFile(null);
  };

  // Load user's folders from Google Drive
  const loadDriveFolders = async (token?: string) => {
    const activeTkn = token || driveToken;
    if (!activeTkn) return;

    try {
      const folders = await listDriveFolders(activeTkn);
      setDriveFolders(folders);

      // Try to find a folder named 'remitos' or 'remitos pendientes'
      let targetFolder = folders.find(f => f.name.toLowerCase().includes('remito'));

      // If we had a stored folder in localStorage, check if still exists
      const storedId = localStorage.getItem('job_martin_bandiera_drive_folder_id');
      if (storedId && folders.some(f => f.id === storedId)) {
        targetFolder = folders.find(f => f.id === storedId);
      }

      if (targetFolder) {
        setSelectedDriveFolderId(targetFolder.id);
        setSelectedDriveFolderName(targetFolder.name);
        localStorage.setItem('job_martin_bandiera_drive_folder_id', targetFolder.id);
        await loadFilesInFolder(targetFolder.id, activeTkn);
      } else if (folders.length > 0) {
        setSelectedDriveFolderId(folders[0].id);
        setSelectedDriveFolderName(folders[0].name);
        await loadFilesInFolder(folders[0].id, activeTkn);
      }
    } catch (err: any) {
      console.error('Error loading drive folders:', err);
    }
  };

  // Load files in the selected folder
  const loadFilesInFolder = async (folderId?: string, token?: string) => {
    const activeTkn = token || driveToken;
    const targetFolderId = folderId || selectedDriveFolderId;
    if (!activeTkn) return;

    setIsLoadingDriveFiles(true);
    try {
      const files = await listScannedFilesInFolder(targetFolderId || undefined, activeTkn);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Error loading files in folder:', err);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  // Handle changing selected folder
  const handleFolderChange = async (folderId: string) => {
    setSelectedDriveFolderId(folderId);
    const found = driveFolders.find(f => f.id === folderId);
    if (found) setSelectedDriveFolderName(found.name);
    localStorage.setItem('job_martin_bandiera_drive_folder_id', folderId);
    await loadFilesInFolder(folderId);
  };

  // Create folder in Drive
  const handleCreateDriveFolder = async () => {
    if (!newFolderNameInput.trim() || !driveToken) return;

    setIsCreatingFolder(true);
    try {
      const newFolder = await createDriveFolder(newFolderNameInput.trim(), undefined, driveToken);
      setDriveFolders(prev => [newFolder, ...prev]);
      setSelectedDriveFolderId(newFolder.id);
      setSelectedDriveFolderName(newFolder.name);
      localStorage.setItem('job_martin_bandiera_drive_folder_id', newFolder.id);
      setShowNewFolderModal(false);
      setNewFolderNameInput('Remitos Pendientes');
      await loadFilesInFolder(newFolder.id, driveToken);
    } catch (err: any) {
      console.error('Error creating folder in Drive:', err);
      alert(err?.message || 'Error al crear la carpeta en Drive');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Download file from Drive and automatically scan with AI
  const handleSelectAndScanDriveFile = async (file: DriveFileItem) => {
    if (!driveToken) return;

    setIsScanning(true);
    setScanStep(`Descargando "${file.name}" desde tu Google Drive...`);
    setScanError(null);
    setCurrentSelectedDriveFile(file);

    try {
      const { base64Data, mimeType } = await downloadDriveFileAsBase64(file.id, driveToken);
      setSelectedImage(base64Data);
      setImageMimeType(mimeType);
      setImageRotation(0);
      setImageZoom(1);

      // Trigger AI Scan directly with the downloaded image
      await executeScanWithImage(base64Data, mimeType);
    } catch (err: any) {
      console.error('Error processing drive file:', err);
      setScanError(err?.message || 'Error al descargar o procesar archivo de Drive.');
      setIsScanning(false);
    }
  };

  // Core AI Scan logic reusable for local uploads and Drive downloads
  const executeScanWithImage = async (imgData: string, mime: string, retryCount = 0) => {
    setIsScanning(true);
    setScanError(null);
    setScanStep(retryCount > 0 ? `Reintentando lectura con IA (intento ${retryCount + 1}/3)...` : 'Analizando caligrafía manuscrita con Gemini Vision...');

    try {
      const idToken = await getCurrentIdToken();
      const response = await fetch('/api/ai/scan-remito', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          image: imgData,
          mimeType: mime,
          knownClients: clientNamesList,
          knownWorkers: workerNamesList
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let rawError = errorData.error || `Error del servidor HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(rawError);
          if (parsed?.error?.message) rawError = parsed.error.message;
        } catch {}

        if (response.status === 503 && retryCount < 2) {
          setScanStep('Servidor con alta demanda temporal. Reintentando automáticamente en 1.5s...');
          await new Promise(r => setTimeout(r, 1500));
          return executeScanWithImage(imgData, mime, retryCount + 1);
        }

        throw new Error(rawError);
      }

      setScanStep('Interpretando datos manuscritos y cuadrilla...');
      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'No se pudieron extraer datos del remito.');
      }

      const d: ExtractedRemitoData = result.data;

      // Populate extracted fields into editable form state
      if (d.remitoPapel) setRemitoPapel(d.remitoPapel);
      if (d.fecha) setFecha(d.fecha);
      if (d.cliente) setCliente(d.cliente);
      if (d.ubicacion) setUbicacion(d.ubicacion);
      if (d.puntoTrabajo) setPuntoTrabajo(d.puntoTrabajo);
      if (d.descripcion) setDescripcion(d.descripcion);
      if (d.horaEntrada) setHoraEntrada(d.horaEntrada);
      if (d.horaSalida) setHoraSalida(d.horaSalida);
      if (d.horasTrabajadas && d.horasTrabajadas > 0) setHorasTrabajadas(d.horasTrabajadas);
      if (d.kilometros !== undefined) setKilometros(d.kilometros);
      if (d.viajes !== undefined) setViajes(d.viajes);
      if (d.esGuardia !== undefined) setIsGuardia(d.esGuardia);
      if (d.tecnicoLider) setTecnicoLider(d.tecnicoLider);
      if (d.confianzaLectura !== undefined) setScanConfidence(d.confianzaLectura);
      if (d.observaciones) setRawAiNotes(d.observaciones);

      // Populate cuadrilla / team members
      if (Array.isArray(d.cuadrilla) && d.cuadrilla.length > 0) {
        const assignedTeam: TeamMemberAssigned[] = d.cuadrilla.map(c => {
          const roleNormalized: 'Oficial' | 'Ayudante' =
            c.rol?.toLowerCase().includes('oficial') ? 'Oficial' : 'Ayudante';
          const rate = roleNormalized === 'Oficial'
            ? (technicalParameters.horaOficial || 9400)
            : (technicalParameters.pagoAyudanteHora || 5500);
          return {
            name: c.nombre.toUpperCase(),
            role: roleNormalized,
            rate
          };
        });
        setTeamMembers(assignedTeam);
      } else {
        // Si la IA no lee personal, el campo queda vacío: no se inventa una cuadrilla.
        setTeamMembers([]);
      }

      // Populate materials
      if (Array.isArray(d.materiales) && d.materiales.length > 0) {
        setDetectedMaterialsList(d.materiales);
      }

      setScanStep('¡Lectura de remito completada con éxito!');
    } catch (err: any) {
      console.error('Scan error:', err);
      let errMsg = err?.message || 'Error al conectar con el servicio de lectura IA.';
      try {
        const p = JSON.parse(errMsg);
        if (p?.error?.message) errMsg = p.error.message;
      } catch {}
      setScanError(errMsg);
    } finally {
      setIsScanning(false);
    }
  };

  // Perform AI analysis on uploaded image with auto-retry
  const handleScanImage = async (retryCount = 0) => {
    if (!selectedImage) return;
    await executeScanWithImage(selectedImage, imageMimeType, retryCount);
  };

  // Instant preloader for the user's real uploaded paper remito (El Magistral Nº 0002-00010966)
  const handlePreloadUserRemito = () => {
    setRemitoPapel('0002-00010966');
    setFecha('2026-08-03');
    setCliente('EL MAGISTRAL');
    setUbicacion('LOS PINTADOS');
    setPuntoTrabajo('CABAÑA, GALPÓN, SALA DE RIEGO');
    setHoraEntrada('13:30');
    setHoraSalida('17:00');
    setHorasTrabajadas(3.5);
    setKilometros(35);
    setViajes(1);
    setIsGuardia(false);
    setTecnicoLider('FACUNDO');
    setDescripcion(
      'Se realiza en cabaña el cambio de disyuntor que era chico, se cambió a uno de 40A. En galpón se realizó el cambio de un fotocontrol y en sala de riego se cambian dos fotocontroles ya que los que estaban se encontraban dañados. En sala de riego se encontró luminaria dañada.'
    );
    setTeamMembers([
      { name: 'FACUNDO', role: 'Oficial', rate: technicalParameters.horaOficial || 9400 },
      { name: 'MATÍAS V', role: 'Ayudante', rate: technicalParameters.pagoAyudanteHora || 5500 }
    ]);
    // El papel no detalla materiales (casillero de cantidad vacío): se completan al convertir.
    setDetectedMaterialsList([]);
    setScanConfidence(96);
    setRawAiNotes('Remito Nº 0002-00010966: 2 personas, 3,5 hs (13:30 a 17:00). Fecha confirmada: 03/08/2026.');
    setScanError(null);
  };

  // Add extra crew member manually
  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    const rate = newMemberRole === 'Oficial'
      ? (technicalParameters.horaOficial || 9400)
      : (technicalParameters.pagoAyudanteHora || 5500);

    setTeamMembers(prev => [
      ...prev,
      { name: newMemberName.trim().toUpperCase(), role: newMemberRole, rate }
    ]);
    setNewMemberName('');
  };

  const handleToggleMemberRole = (idx: number) => {
    setTeamMembers(prev =>
      prev.map((m, i) => {
        if (i === idx) {
          const nextRole: 'Oficial' | 'Ayudante' = m.role === 'Oficial' ? 'Ayudante' : 'Oficial';
          const rate = nextRole === 'Oficial'
            ? (technicalParameters.horaOficial || 9400)
            : (technicalParameters.pagoAyudanteHora || 5500);
          return { ...m, role: nextRole, rate };
        }
        return m;
      })
    );
  };

  const handleRemoveMember = (idx: number) => {
    setTeamMembers(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculate live costs based on current form parameters
  const calculatedCosts = useMemo(() => {
    return calculateAuditCosts(technicalParameters, {
      hoursWorked: horasTrabajadas,
      travelHours: viajes * 1.5,
      viajes,
      distanceKm: kilometros,
      isGuardia,
      guardiaType: isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
      helpersCount: teamMembers.length,
      materialsCost: materialCostEstimated,
      leadTechName: tecnicoLider || currentUser.displayName || 'Técnico Líder',
      helperNames: teamMembers.map(m => m.name),
      teamMembers,
      workers,
      users
    });
  }, [
    technicalParameters,
    horasTrabajadas,
    viajes,
    kilometros,
    isGuardia,
    teamMembers,
    materialCostEstimated,
    tecnicoLider,
    currentUser.displayName,
    workers,
    users
  ]);

  // Build the final record for the preview and saving
  const previewRecord: TechnicalAuditRecord = useMemo(() => {
    return {
      id: `sandbox-ocr-${Date.now()}`,
      remitoId: `TEST-#${nextRemitoNumber}-2026`,
      remitoPapel: remitoPapel.trim() || undefined,
      date: fecha,
      clientName: cliente.trim().toUpperCase() || 'CLIENTE DE PRUEBA',
      siteLocation: ubicacion.trim().toUpperCase() || 'UBICACIÓN CAMPO',
      workPoint: puntoTrabajo.trim().toUpperCase() || 'PUNTO INTERNO',
      isGuardia,
      guardiaType: isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
      hoursWorked: horasTrabajadas,
      travelHours: viajes * 1.5,
      viajes,
      distanceKm: kilometros,
      horaEntrada,
      horaSalida,
      logisticsCost: calculatedCosts.logisticsCost,
      fuelCost: calculatedCosts.fuelCost,
      seguroCost: calculatedCosts.seguroCost,
      amortizacionCost: calculatedCosts.amortizacionCost,
      laborDirectCost: calculatedCosts.laborDirectCost,
      operatingCost: calculatedCosts.operatingCost,
      materialsCost: materialCostEstimated,
      materialsDetails: detectedMaterialsList.map(m => `${m.cantidad ?? 1}x ${m.descripcion}`).join(', ') || undefined,
      description: descripcion.trim() || 'Sin descripción detallada.',
      suggestedPrice: calculatedCosts.suggestedPrice,
      billedPrice: calculatedCosts.suggestedPrice,
      collectedPrice: 0,
      helperPay: calculatedCosts.helperPay,
      techPay: calculatedCosts.techPay,
      leadTech: tecnicoLider || currentUser.displayName || 'Técnico Responsable',
      helpers: teamMembers.map(m => m.name),
      teamMembers,
      status: 'Cargado',
      semaforo: 'rojo'
    };
  }, [
    nextRemitoNumber,
    remitoPapel,
    fecha,
    cliente,
    ubicacion,
    puntoTrabajo,
    isGuardia,
    horasTrabajadas,
    viajes,
    kilometros,
    horaEntrada,
    horaSalida,
    calculatedCosts,
    materialCostEstimated,
    detectedMaterialsList,
    descripcion,
    tecnicoLider,
    currentUser.displayName,
    teamMembers
  ]);

  const handleSaveToSandbox = async () => {
    // If loaded from Drive and user requested automatic moving to processed folder
    if (currentSelectedDriveFile && moveAfterProcess && selectedDriveFolderId && driveToken) {
      try {
        let processedFolder = driveFolders.find(f => f.name.toLowerCase().includes('procesad'));
        if (!processedFolder) {
          processedFolder = await createDriveFolder('Remitos Procesados', undefined, driveToken);
          setDriveFolders(prev => [...prev, processedFolder!]);
        }
        await moveDriveFile(currentSelectedDriveFile.id, selectedDriveFolderId, processedFolder.id, driveToken);
        await loadFilesInFolder(selectedDriveFolderId, driveToken);
        setCurrentSelectedDriveFile(null);
      } catch (err: any) {
        console.warn('Could not move file in Drive:', err);
      }
    }
    onSaveToSandbox(previewRecord);
  };

  return (
    <div className="space-y-6">
      
      {/* BANNER INFORMATIVO DE SEGURIDAD */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p className="font-bold text-slate-900 dark:text-white">
            Laboratorio de Lectura y Digitalización de Remitos en Papel con IA (Entorno Sandbox)
          </p>
          <p>
            Prueba cómo la Inteligencia Artificial reconoce la <strong>letra manuscrita</strong>, extrae horas, clientes, personal y tareas, y calcula en tiempo real los costos operativos exactamente como se verá en la <strong>Tabla de Administración</strong>.
            <strong className="text-amber-600 dark:text-amber-400"> Este entorno está aislado: nada de lo que pruebes aquí se guarda en producción ni altera la nómina, salvo que pases un remito a producción de forma expresa (botón "A Producción", con confirmación).</strong>
          </p>
        </div>
      </div>

      {/* SECCIÓN 1: CARGA DE LA FOTO DEL REMITO CON PESTAÑAS DE ORIGEN */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
        
        {/* ENCABEZADO Y SELECTOR DE ORIGEN */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-500" />
              <span>1. Origen del Remito en Papel Manuscrito</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Conecta tu carpeta de Google Drive, sube una foto desde tu dispositivo o prueba el ejemplo
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start md:self-center">
            <button
              type="button"
              onClick={() => setSourceMode('drive')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                sourceMode === 'drive'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Google Drive</span>
            </button>

            <button
              type="button"
              onClick={() => setSourceMode('local')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                sourceMode === 'local'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Foto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSourceMode('ejemplo');
                handleLoadSampleRemito();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                sourceMode === 'ejemplo'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Ejemplo</span>
            </button>
          </div>
        </div>

        {/* ORIGEN 1: GOOGLE DRIVE */}
        {sourceMode === 'drive' && (
          <div className="space-y-4">
            {!driveToken ? (
              <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-amber-500/10 to-emerald-500/10 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Sincronización Automática con Google Drive
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                      Conecta tu cuenta de Google. Podrás elegir o crear una carpeta (por ejemplo, <strong>"Remitos Pendientes"</strong>). Cuando los técnicos saquen fotos con el celular y las guarden en esa carpeta, la aplicación las leerá y procesará directamente con Inteligencia Artificial.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isConnectingDrive}
                  onClick={handleConnectGoogleDrive}
                  className="px-5 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 shadow-md cursor-pointer shrink-0 transition-all"
                >
                  {isConnectingDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4 text-amber-400 dark:text-amber-600" />
                      <span>Conectar con Google Drive</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* BARRA DE ESTADO DE DRIVE Y SELECTOR DE CARPETA */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-slate-900 dark:text-white">
                          Google Drive Conectado
                        </span>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full font-bold">
                          Activo
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {driveUser?.email || 'Cuenta de Google activa'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* SELECTOR DE CARPETA */}
                    <div className="flex items-center gap-1.5">
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <select
                        value={selectedDriveFolderId}
                        onChange={e => handleFolderChange(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white cursor-pointer"
                      >
                        {driveFolders.length === 0 ? (
                          <option value="">(Cargando carpetas...)</option>
                        ) : (
                          driveFolders.map(f => (
                            <option key={f.id} value={f.id}>
                              📁 {f.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* BOTÓN CREAR CARPETA REMITOS PENDIENTES */}
                    <button
                      type="button"
                      onClick={() => setShowNewFolderModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Crear nueva carpeta en tu Drive"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
                      <span>Nueva Carpeta</span>
                    </button>

                    {/* ACTUALIZAR ARCHIVOS */}
                    <button
                      type="button"
                      onClick={() => loadFilesInFolder()}
                      disabled={isLoadingDriveFiles}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Refrescar archivos de Drive"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingDriveFiles ? 'animate-spin' : ''}`} />
                      <span>Actualizar</span>
                    </button>

                    {/* DESCONECTAR */}
                    <button
                      type="button"
                      onClick={handleDisconnectGoogleDrive}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                      title="Desconectar cuenta de Drive"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* MODAL / INPUT PARA CREAR CARPETA */}
                {showNewFolderModal && (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-amber-600 shrink-0" />
                      <input
                        type="text"
                        placeholder="Nombre de la carpeta (ej: Remitos Pendientes)"
                        value={newFolderNameInput}
                        onChange={e => setNewFolderNameInput(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isCreatingFolder}
                        onClick={handleCreateDriveFolder}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                      >
                        {isCreatingFolder ? 'Creando...' : 'Crear en Drive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewFolderModal(false)}
                        className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* LISTADO DE REMITOS EN LA CARPETA SELECCIONADA DE DRIVE */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Folder className="w-4 h-4 text-amber-500" />
                      <span>Archivos en {selectedDriveFolderName || 'carpeta seleccionada'}: ({driveFiles.length})</span>
                    </span>

                    <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={moveAfterProcess}
                        onChange={e => setMoveAfterProcess(e.target.checked)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      <span>Mover a subcarpeta <strong>"Remitos Procesados"</strong> al guardar en Sandbox</span>
                    </label>
                  </div>

                  {isLoadingDriveFiles ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Consultando archivos en Google Drive...</span>
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-800/20">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No hay archivos nuevos en la carpeta "{selectedDriveFolderName || 'seleccionada'}".
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                        Sube una foto o escaneo de un remito a esta carpeta desde la app de <strong>Google Drive</strong> en el teléfono, y presiona el botón <strong>"Actualizar"</strong> arriba.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {driveFiles.map(file => {
                        const isCurrent = currentSelectedDriveFile?.id === file.id;
                        return (
                          <div
                            key={file.id}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              isCurrent
                                ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-400'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {file.thumbnailLink ? (
                                <img
                                  src={file.thumbnailLink}
                                  alt={file.name}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                  <FileText className="w-6 h-6" />
                                </div>
                              )}
                              <div className="overflow-hidden space-y-0.5">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {file.createdTime ? new Date(file.createdTime).toLocaleDateString('es-AR') : 'Fecha reciente'}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isScanning}
                              onClick={() => handleSelectAndScanDriveFile(file)}
                              className={`w-full py-2 px-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                                isCurrent
                                  ? 'bg-amber-500 text-slate-950 font-black'
                                  : 'bg-slate-900 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{isCurrent ? 'Remito Seleccionado' : 'Escanear con IA'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ORIGEN 2: SUBIDA MANUAL LOCAL */}
        {sourceMode === 'local' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-3 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Seleccionar Foto o Escaneo de Remito</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />
          </div>
        )}

        {/* CONTENEDOR DE VISTA PREVIA DE LA FOTO */}
        {selectedImage ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Visualizador de la imagen con controles */}
            <div className="lg:col-span-6 bg-slate-950 rounded-2xl border border-slate-800 p-3 overflow-hidden flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-2 px-1 text-slate-400 text-xs border-b border-slate-800 mb-2">
                <span className="font-mono text-[11px]">Vista previa del papel</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Girar 90°"
                    onClick={() => setImageRotation(r => (r + 90) % 360)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Acercar"
                    onClick={() => setImageZoom(z => Math.min(2.5, z + 0.25))}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Alejar"
                    onClick={() => setImageZoom(z => Math.max(0.5, z - 0.25))}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Cambiar foto"
                    onClick={() => setSelectedImage(null)}
                    className="text-[11px] text-rose-400 hover:underline font-bold ml-2 cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
              </div>

              <div className="w-full max-h-[380px] overflow-auto flex items-center justify-center bg-slate-900/60 rounded-xl p-2">
                <img
                  src={selectedImage}
                  alt="Remito Manuscrito"
                  style={{
                    transform: `rotate(${imageRotation}deg) scale(${imageZoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-in-out'
                  }}
                  className="max-w-full max-h-[360px] object-contain rounded shadow-lg"
                />
              </div>
            </div>

            {/* Acción de Escaneo con IA */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-cyan-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">
                      Motor Gemini Vision (OCR Manuscrito)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Capaz de transcribir caligrafía a mano alzada, asociar operarios y calcular costos
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Haz clic en el botón de abajo para que el modelo examine cada rincón de la foto: número de remito, cliente, finca, horas, tareas efectuadas y personal participante.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => handleScanImage(0)}
                    className="flex-1 py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="truncate">{scanStep || 'Analizando imagen...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Escanear y Extraer Datos con IA</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePreloadUserRemito}
                    className="py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    title="Carga directamente los campos de la foto de El Magistral"
                  >
                    <FileCheck2 className="w-4 h-4 text-emerald-500" />
                    <span>Cargar Datos Remito Foto</span>
                  </button>
                </div>

                {/* Status messages */}
                {scanError && (
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 dark:text-white">Aviso de Procesamiento:</p>
                        <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">{scanError}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-rose-200/60 dark:border-rose-900/60">
                      <button
                        type="button"
                        onClick={() => handleScanImage(0)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar con IA</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePreloadUserRemito}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Pre-cargar Datos de este Remito</span>
                      </button>
                    </div>
                  </div>
                )}

                {scanConfidence !== null && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-bold">Lectura completada</span>
                    </div>
                    <span className="text-[11px] font-mono font-black bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full">
                      Confianza caligrafía: {scanConfidence}%
                    </span>
                  </div>
                )}

                {rawAiNotes && (
                  <p className="text-[11px] text-slate-500 italic bg-white/60 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    💡 <strong>Observaciones IA:</strong> {rawAiNotes}
                  </p>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-10 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 transition-colors flex flex-col items-center justify-center text-center space-y-3 cursor-pointer bg-slate-50/50 dark:bg-slate-800/30"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Camera className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Arrastra aquí la foto del remito de papel o haz clic para subirla
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Formatos JPG, PNG, WEBP o PDF. También puedes pulsar arriba en <strong>"Probar con Remito de Ejemplo"</strong> para probarlo sin subir nada.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: FORMULARIO DE REVISIÓN Y AJUSTES DE LOS DATOS EXTRAÍDOS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              <span>2. Datos Extraídos del Remito (Revisa y Modifica Libremente)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Puedes corregir o agregar cualquier campo antes de ver la tabla final
            </p>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            Formulario Editable
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          
          {/* Nº Remito Papel */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <span>Nº Remito Papel (Talonario)</span>
              <span className="text-amber-500 font-normal text-[10px]">*Detectado</span>
            </label>
            <input
              type="text"
              placeholder="Ej: 0001-0004523"
              value={remitoPapel}
              onChange={e => setRemitoPapel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Fecha del Servicio
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
            />
          </div>

          {/* Cliente */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Cliente / Finca / Empresa
            </label>
            <input
              type="text"
              placeholder="Nombre del cliente o bodega..."
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white uppercase"
            />
          </div>

          {/* Ubicación */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Ubicación / Localidad / Finca
            </label>
            <input
              type="text"
              placeholder="Ej: San Carlos, Valle de Uco..."
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white"
            />
          </div>

          {/* Punto interno */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Punto Interno / Sector
            </label>
            <input
              type="text"
              placeholder="Ej: Pozo Nº 4 - Tablero Principal..."
              value={puntoTrabajo}
              onChange={e => setPuntoTrabajo(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white"
            />
          </div>

          {/* Horas trabajadas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Horas Trabajadas
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={horasTrabajadas}
              onChange={e => setHorasTrabajadas(Math.max(0.5, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>

          {/* Kilómetros */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Distancia (KM)
            </label>
            <input
              type="number"
              min="0"
              value={kilometros}
              onChange={e => setKilometros(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>

          {/* Viajes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Viajes
              </label>
              {viajes > 0 && (
                <button
                  type="button"
                  onClick={() => setViajes(0)}
                  className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                >
                  Sin viajes (0)
                </button>
              )}
            </div>
            <input
              type="number"
              min="0"
              value={viajes}
              onChange={e => setViajes(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-center text-slate-900 dark:text-white"
            />
          </div>

          {/* Guardia */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ¿Servicio de Guardia?
            </label>
            <select
              value={isGuardia ? 'SI' : 'NO'}
              onChange={e => setIsGuardia(e.target.value === 'SI')}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
            >
              <option value="NO">Normal</option>
              <option value="SI">Guardia (+50%)</option>
            </select>
          </div>
        </div>

        {/* Descripción de Tareas */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Descripción de Trabajos y Tareas Realizadas (Texto Manuscrito Digitalizado)
          </label>
          <textarea
            rows={3}
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Detalle de tareas..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-sans text-xs leading-relaxed text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Cuadrilla y Personal Asignado */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-500" />
              <span>Personal y Cuadrilla Detectada ({teamMembers.length} Operarios)</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Haz clic sobre el rol de cada operario para alternar Oficial / Ayudante
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {teamMembers.map((m, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs shadow-xs"
              >
                <span className="font-bold text-slate-900 dark:text-white">{m.name}</span>
                <button
                  type="button"
                  onClick={() => handleToggleMemberRole(idx)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase cursor-pointer ${
                    m.role === 'Oficial'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                  title="Cambiar rol"
                >
                  {m.role} (${formatCurrency(m.rate)}/h)
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(idx)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Agregar personal adicional */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <input
              type="text"
              placeholder="Nombre de otro operario..."
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
            />
            <select
              value={newMemberRole}
              onChange={e => setNewMemberRole(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value="Ayudante">Ayudante</option>
              <option value="Oficial">Oficial</option>
            </select>
            <button
              type="button"
              onClick={handleAddMember}
              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>
        </div>

      </div>

      {/* SECCIÓN 3: PREVISUALIZACIÓN IDÉNTICA A LA TABLA DE ADMINISTRACIÓN (El requerimiento exacto) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Table2 className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                3. Previsualización Idéntica: Cómo Quedará Cargado en la Tabla de Administración
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Esta fila reproduce de manera exacta las columnas, colores, semáforo y cálculos automáticos del sistema
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToSandbox}
              className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar en Remitos de Prueba (Sandbox)</span>
            </button>
          </div>
        </div>

        {/* TABLA DE AUDITORÍA TÉCNICA - FILA RÉPLICA */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-3 text-center">SEMÁFORO</th>
                <th className="py-3 px-3">SISTEMA</th>
                <th className="py-3 px-3">PAPEL</th>
                <th className="py-3 px-3">FECHA</th>
                <th className="py-3 px-3">CLIENTE / SEDE</th>
                <th className="py-3 px-3">PUNTO INTERNO</th>
                <th className="py-3 px-3 min-w-[200px]">DESCRIPCIÓN</th>
                <th className="py-3 px-3 text-center">GUARDIA</th>
                <th className="py-3 px-3 text-center">HS</th>
                <th className="py-3 px-3 text-right">LOGÍSTICA ($)</th>
                <th className="py-3 px-3 text-right">M.O. OFICIAL ($)</th>
                <th className="py-3 px-3 text-right">M.O. AYUDANTE ($)</th>
                <th className="py-3 px-3 text-right">MAT. ($)</th>
                <th className="py-3 px-3">EQUIPO</th>
                <th className="py-3 px-3 text-right">COSTO TOTAL ($)</th>
                <th className="py-3 px-3 text-center">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-sans">
              <tr className="hover:bg-amber-50/20 dark:hover:bg-slate-800/30 transition-colors">
                
                {/* SEMÁFORO */}
                <td className="py-3 px-3 text-center">
                  <span className="inline-block w-3.5 h-3.5 rounded-full bg-rose-500 shadow-xs ring-2 ring-rose-300 dark:ring-rose-900" title="Cargado - Pendiente de Facturación" />
                </td>

                {/* SISTEMA */}
                <td className="py-3 px-3">
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                    {previewRecord.remitoId}
                  </span>
                </td>

                {/* PAPEL */}
                <td className="py-3 px-3">
                  {previewRecord.remitoPapel ? (
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded text-[11px] border border-amber-300 dark:border-amber-800">
                      📄 #{previewRecord.remitoPapel}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Sin papel</span>
                  )}
                </td>

                {/* FECHA */}
                <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {previewRecord.date}
                </td>

                {/* CLIENTE */}
                <td className="py-3 px-3">
                  <span className="font-bold text-slate-900 dark:text-white uppercase block">
                    {previewRecord.clientName}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {previewRecord.siteLocation}
                  </span>
                </td>

                {/* PUNTO */}
                <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                  {previewRecord.workPoint || '-'}
                </td>

                {/* DESCRIPCIÓN */}
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300 leading-tight">
                  <p className="line-clamp-2 text-[11px]">{previewRecord.description}</p>
                </td>

                {/* GUARDIA */}
                <td className="py-3 px-3 text-center whitespace-nowrap">
                  {previewRecord.isGuardia ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Guardia 50%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Normal</span>
                  )}
                </td>

                {/* HORAS */}
                <td className="py-3 px-3 text-center font-mono font-black text-slate-800 dark:text-slate-200">
                  {previewRecord.hoursWorked} hs
                </td>

                {/* LOGÍSTICA ($) */}
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  ${formatCurrency(previewRecord.logisticsCost)}
                </td>

                {/* M.O. OFICIAL ($) */}
                <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  ${formatCurrency(previewRecord.techPay)}
                </td>

                {/* M.O. AYUDANTE ($) */}
                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  ${formatCurrency(previewRecord.helperPay)}
                </td>

                {/* MATERIALES ($) */}
                <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  ${formatCurrency(previewRecord.materialsCost)}
                </td>

                {/* EQUIPO */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    {previewRecord.teamMembers?.map((m, idx) => (
                      <span key={idx} className="text-[10px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.role === 'Oficial' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        <span>{m.name}</span>
                      </span>
                    ))}
                  </div>
                </td>

                {/* COSTO TOTAL ($) */}
                <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap bg-amber-50/40 dark:bg-amber-950/20">
                  ${formatCurrency(previewRecord.operatingCost)}
                </td>

                {/* ESTADO */}
                <td className="py-3 px-3 text-center whitespace-nowrap">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Cargado
                  </span>
                </td>

              </tr>
            </tbody>
          </table>
        </div>

        {/* RESUMEN DE COSTOS Y MARGEN OPERATIVO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Logística (Comb. + Seguro + Amort.)</span>
            <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
              ${formatCurrency(previewRecord.logisticsCost)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {previewRecord.viajes} viaje(s) • {previewRecord.distanceKm} km ida
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Mano de Obra Cuadrilla</span>
            <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
              ${formatCurrency(previewRecord.laborDirectCost)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {previewRecord.hoursWorked} hs x {teamMembers.length} operarios
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Costo Operativo Base</span>
            <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
              ${formatCurrency(previewRecord.operatingCost)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Suma de logística + personal
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700">
            <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase block">Precio Sugerido Venta</span>
            <span className="text-sm font-black font-mono text-amber-700 dark:text-amber-300">
              ${formatCurrency(previewRecord.suggestedPrice)}
            </span>
            <span className="text-[10px] text-amber-600/80 block mt-0.5">
              Con margen técnico sugerido
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
