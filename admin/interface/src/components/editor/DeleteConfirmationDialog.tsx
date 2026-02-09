import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button.variants';
import { useBlockEditor } from '@/contexts/BlockEditorContext.tsx';

export const DeleteConfirmationDialog: React.FC = () => {
  const { isDeleteModalOpen, confirmDeleteBlock, cancelDeleteBlock } = useBlockEditor();

  return (
    <AlertDialog open={isDeleteModalOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the block and all its connections.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelDeleteBlock}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDeleteBlock} className={buttonVariants({ variant: "destructive" })}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
