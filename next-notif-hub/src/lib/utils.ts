import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only recognizes T-shirt-size suffixes (sm/md/lg/xl/...) for
// rounded-*/shadow-*/drop-shadow-* by default, so it can't tell that our
// custom-named tokens (rounded-input, shadow-card, drop-shadow-logo, ...)
// conflict with Tailwind's built-ins (rounded-md, shadow-xs, ...). Without
// this, both classes survive the merge and whichever Tailwind happens to
// emit later in the stylesheet wins — not whichever we put last in
// className. Registering our token names here makes overrides deterministic.
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            radius: ['card', 'button', 'button-lg', 'input', 'textarea', 'pill'],
            shadow: ['card', 'brand', 'login-card', 'primary-glow'],
            'drop-shadow': ['logo'],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
