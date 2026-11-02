import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useWatch } from "@domicile-desktop/react/use-watch";
import { DownloadsItem } from "./DownloadsItem";

/**
 * The desk's downloads, from every browser and app window: shown while there
 * are any, with how far the ones in progress have come. The engine lists them.
 */
export const Downloads = () => {
  const domicile = useDomicile();
  const downloads = useWatch(
    domicile.downloads,
    "change",
    () => domicile.downloads.list,
  );
  return (
    <DownloadsItem
      downloads={downloads}
      onCancel={domicile.downloads.cancel}
      onClear={domicile.downloads.clear}
      onOpen={(path) => {
        domicile.processes.launch(["xdg-open", path]);
      }}
      onRemove={domicile.downloads.remove}
      onShowInFolder={(path) => {
        domicile.processes.launch([
          "xdg-open",
          path.slice(0, path.lastIndexOf("/")),
        ]);
      }}
    />
  );
};
