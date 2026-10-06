import { photoForMonth, photoSrc, photoSrcSet, type SeasonPhoto as Photo } from '../content/photos';
import { Icon } from './icons';

interface Props {
  month: number;
  sizes: string;
  class?: string;
  /** Shows the credit button over the photo. Off where a caption shows it instead. */
  credit?: boolean;
}

/** The month's photo at the right size for the screen, or the month's colour if there is none yet. */
export function SeasonPhoto({ month, sizes, class: cls = '', credit = true }: Props) {
  const photo = photoForMonth(month);
  if (!photo) return <div class={`season-photo season-photo-empty ${cls}`} aria-hidden="true" />;
  return (
    <div class={`season-photo ${cls}`} style={{ backgroundColor: photo.colour }}>
      <picture>
        <source type="image/avif" srcSet={photoSrcSet(photo, 'avif')} sizes={sizes} />
        <img
          src={photoSrc(photo, photo.widths[1] ?? photo.widths[0]!, 'webp')}
          srcSet={photoSrcSet(photo, 'webp')}
          sizes={sizes}
          alt={photo.alt}
          decoding="async"
          style={{ objectPosition: `${photo.focus[0]}% ${photo.focus[1]}%` }}
        />
      </picture>
      {credit && <PhotoCredit photo={photo} />}
    </div>
  );
}

export function PhotoCredit({ photo, inline = false }: { photo: Photo; inline?: boolean }) {
  return (
    <details class={inline ? 'credit credit-inline' : 'credit'}>
      <summary aria-label="Photo credit">
        <Icon name="info" size={16} />
        <span class="credit-short">
          {photo.author.replace(/ from .*$/, '')} · {photo.licence}
        </span>
      </summary>
      <div class="credit-full">
        <a href={photo.sourceUrl} target="_blank" rel="noopener">
          {photo.title}
        </a>{' '}
        by {photo.author}.{' '}
        <a href={photo.licenceUrl} target="_blank" rel="noopener license">
          {photo.licence}
        </a>
        . {photo.changes}
      </div>
    </details>
  );
}
