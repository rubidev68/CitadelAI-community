import { useContext } from 'react';
import { BlockEditorContext } from './BlockEditorContext.context';

export const useBlockEditor = () => {
  const context = useContext(BlockEditorContext);
  if (!context) {
    throw new Error('useBlockEditor must be used within a BlockEditorProvider');
  }
  return context;
};
