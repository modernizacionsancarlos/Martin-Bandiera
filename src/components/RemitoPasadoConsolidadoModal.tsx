import React from 'react';
import { TechnicalAuditRecord } from '../types';
import { RemitoPasadoModal } from './RemitoPasadoModal';

interface RemitoPasadoConsolidadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: TechnicalAuditRecord[];
  onArchiveSuccess?: () => void;
}

export const RemitoPasadoConsolidadoModal: React.FC<RemitoPasadoConsolidadoModalProps> = ({
  isOpen,
  onClose,
  records,
  onArchiveSuccess
}) => {
  return (
    <RemitoPasadoModal
      isOpen={isOpen}
      onClose={onClose}
      records={records}
      onConfirmPasado={onArchiveSuccess}
    />
  );
};
