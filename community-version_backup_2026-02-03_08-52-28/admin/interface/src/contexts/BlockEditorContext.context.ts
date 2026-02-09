import { createContext } from 'react';
import { BlockEditorContextType } from './BlockEditorContext';

export const BlockEditorContext = createContext<BlockEditorContextType | undefined>(undefined);
