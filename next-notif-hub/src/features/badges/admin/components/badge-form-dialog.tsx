'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award, Layers, Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ApiError } from '@/lib/api-error';
import { useCreateBadgeMutation } from '../mutations/use-create-badge-mutation';
import { useUpdateBadgeMutation } from '../mutations/use-update-badge-mutation';
import { BADGE_TIERS } from '../../constants';
import type { Badge } from '../../types';

// threshold kept as a string in form state, same reasoning as
// mission-form-dialog.tsx's xpGranted/durationDays fields.
const badgeFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    threshold: z
        .string()
        .min(1, 'Threshold is required')
        .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, 'Threshold must be at least 1'),
    tier: z.enum(BADGE_TIERS, { message: 'Tier is required' }),
    description: z.string(),
});

type BadgeFormValues = z.infer<typeof badgeFormSchema>;

const TIER_LABELS: Record<(typeof BADGE_TIERS)[number], string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    diamond: 'Diamond',
};

interface BadgeFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    badge?: Badge;
}

export function BadgeFormDialog({ open, onOpenChange, badge }: BadgeFormDialogProps) {
    const isEditing = Boolean(badge);
    const createBadge = useCreateBadgeMutation();
    const updateBadge = useUpdateBadgeMutation();

    const form = useForm<BadgeFormValues>({
        resolver: zodResolver(badgeFormSchema),
        defaultValues: { name: '', threshold: '', tier: 'bronze', description: '' },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: badge?.name ?? '',
                threshold: badge ? String(badge.threshold) : '',
                tier: badge?.tier ?? 'bronze',
                description: badge?.description ?? '',
            });
        }
    }, [open, badge, form]);

    const isPending = createBadge.isPending || updateBadge.isPending;

    const onSubmit = (values: BadgeFormValues) => {
        const payload = {
            name: values.name,
            threshold: Number(values.threshold),
            tier: values.tier,
            description: values.description === '' ? undefined : values.description,
        };

        const mutation =
            isEditing && badge
                ? updateBadge.mutateAsync({ id: badge.id, data: payload })
                : createBadge.mutateAsync(payload);

        mutation
            .then(() => {
                toast.success(isEditing ? 'Badge updated' : 'Badge created');
                onOpenChange(false);
            })
            .catch((err) => {
                toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit badge' : 'New badge'}</DialogTitle>
                    <DialogDescription>Threshold is the number of completed missions required to unlock it.</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Award
                                                size={16}
                                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray"
                                            />
                                            <Input className="border-border-strong pl-9" {...field} />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="threshold"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unlock at (missions completed)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Target
                                                size={16}
                                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray"
                                            />
                                            <Input
                                                type="number"
                                                min={1}
                                                className="border-border-strong pl-9"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="tier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tier</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger className="w-full border-border-strong">
                                                <span className="flex items-center gap-2">
                                                    <Layers size={16} className="text-gray" />
                                                    <SelectValue placeholder="Select a tier" />
                                                </span>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {BADGE_TIERS.map((tier) => (
                                                <SelectItem key={tier} value={tier}>
                                                    {TIER_LABELS[tier]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (optional)</FormLabel>
                                    <FormControl>
                                        <Textarea className="border-border-strong" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                                className="cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending} className="cursor-pointer gap-2">
                                {isPending && <Loader2 size={16} className="animate-spin" />}
                                {isEditing ? 'Save changes' : 'Create badge'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
