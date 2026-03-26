import { useRef, useState } from 'react';
import { BlockOptions, useBlockActions } from '@yoopta/ui/block-options';
import { YooptaActionMenuList } from './yoopta-action-menu-list';
import { LOCKED_BLOCK_ID } from '@/pages/full-setup/locked-title-block';

type YooptaBlockOptionsProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  blockId: string | null;
  anchor?: HTMLButtonElement | null;
};

export const YooptaBlockOptions = ({ open, onOpenChange, blockId, anchor }: YooptaBlockOptionsProps) => {
  const { duplicateBlock, copyBlockLink, deleteBlock } = useBlockActions();
  const turnIntoRef = useRef<HTMLButtonElement>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const isLockedTitleBlock = blockId === LOCKED_BLOCK_ID;

  const onTurnInto = () => {
    if (isLockedTitleBlock) return;
    setActionMenuAnchor(turnIntoRef.current);
    setActionMenuOpen(true);
  };

  const onActionMenuClose = (menuOpen: boolean) => {
    setActionMenuOpen(menuOpen);
    if (!menuOpen) {
      onOpenChange?.(false);
    }
  };

  const onDuplicate = () => {
    if (!blockId) return;
    duplicateBlock(blockId);
    onOpenChange?.(false);
  };

  const onCopyLink = () => {
    if (!blockId) return;
    copyBlockLink(blockId);
    onOpenChange?.(false);
  };

  const onDelete = () => {
    if (!blockId || isLockedTitleBlock) return;
    deleteBlock(blockId);
    onOpenChange?.(false);
  };

  return (
    <>
      <BlockOptions open={open} onOpenChange={onOpenChange} anchor={anchor}>
        <BlockOptions.Content side="right" align="end">
          <BlockOptions.Group>
            <BlockOptions.Item
              ref={turnIntoRef}
              onSelect={onTurnInto}
              keepOpen
              disabled={isLockedTitleBlock}
            >
              Turn into
            </BlockOptions.Item>
          </BlockOptions.Group>
          <BlockOptions.Separator />
          <BlockOptions.Group>
            <BlockOptions.Item onSelect={onDuplicate}>Duplicate</BlockOptions.Item>
            <BlockOptions.Item onSelect={onCopyLink}>Copy link to block</BlockOptions.Item>
            <BlockOptions.Item
              variant="destructive"
              onSelect={onDelete}
              disabled={isLockedTitleBlock}
            >
              Delete
            </BlockOptions.Item>
          </BlockOptions.Group>
        </BlockOptions.Content>
      </BlockOptions>
      <YooptaActionMenuList placement='right-start' open={actionMenuOpen} onOpenChange={onActionMenuClose} anchor={actionMenuAnchor} />
    </>
  );
};
