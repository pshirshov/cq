/**
 * SlashPopover.tsx — floating autocomplete list for slash commands.
 *
 * Renders an absolutely-positioned <ul> below (visually above) the textarea
 * listing filtered slash-command items. The parent is responsible for
 * positioning context (position: relative on its container).
 *
 * Props:
 *   items         — filtered list of commands to display.
 *   selectedIndex — which item is highlighted (keyboard cursor).
 *   onPick        — called with command name when user clicks an item.
 *   onClose       — called when the popover should close (e.g. outside click).
 */

import styles from "../styles/SlashPopover.module.css";

export interface SlashCommand {
  name: string;
  description?: string;
}

export interface SlashPopoverProps {
  items: SlashCommand[];
  selectedIndex: number;
  onPick: (name: string) => void;
  onClose: () => void;
}

export function SlashPopover({ items, selectedIndex, onPick }: SlashPopoverProps): React.ReactElement {
  return (
    <ul className={styles.popover} role="listbox" aria-label="Slash commands">
      {items.map((item, i) => (
        <li
          key={item.name}
          className={i === selectedIndex ? `${styles.item} ${styles.itemSelected}` : styles.item}
          role="option"
          aria-selected={i === selectedIndex}
          onMouseDown={(e) => {
            // Use mousedown (not click) so the textarea doesn't lose focus.
            e.preventDefault();
            onPick(item.name);
          }}
        >
          <span className={styles.itemName}>{item.name}</span>
          {item.description !== undefined && (
            <span className={styles.itemDesc}>{item.description}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
