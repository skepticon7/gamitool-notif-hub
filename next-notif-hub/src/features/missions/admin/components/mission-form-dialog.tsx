'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, Loader2, Sparkles, Target } from 'lucide-react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ApiError } from '@/lib/api-error';
import { useCreateMissionMutation } from '../mutations/use-create-mission-mutation';
import { useUpdateMissionMutation } from '../mutations/use-update-mission-mutation';
import type { Mission } from '../../types';

// Form state is kept string-only (matching what native number inputs
// actually report via onChange) and converted to real numbers only at
// submit time — avoids fighting react-hook-form/zod over whether a
// z.coerce.number() field's in-flight value is a string or a number.
const missionFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    xpGranted: z
        .string()
        .min(1, 'XP is required')
        .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, 'XP must be a whole number, 0 or more'),
    durationDays: z
        .string()
        .refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 1), 'Duration must be at least 1 day'),
});

type MissionFormValues = z.infer<typeof missionFormSchema>;

interface MissionFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mission?: Mission;
}

export function MissionFormDialog({ open, onOpenChange, mission }: MissionFormDialogProps) {
    const isEditing = Boolean(mission);
    const createMission = useCreateMissionMutation();
    const updateMission = useUpdateMissionMutation();

    const form = useForm<MissionFormValues>({
        resolver: zodResolver(missionFormSchema),
        defaultValues: { name: '', xpGranted: '', durationDays: '' },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: mission?.name ?? '',
                xpGranted: mission ? String(mission.xpGranted) : '',
                durationDays: mission?.durationDays ? String(mission.durationDays) : '',
            });
        }
    }, [open, mission, form]);

    const isPending = createMission.isPending || updateMission.isPending;

    const onSubmit = (values: MissionFormValues) => {
        const payload = {
            name: values.name,
            xpGranted: Number(values.xpGranted),
            durationDays: values.durationDays === '' ? undefined : Number(values.durationDays),
        };

        const mutation =
            isEditing && mission
                ? updateMission.mutateAsync({ id: mission.id, data: payload })
                : createMission.mutateAsync(payload);

        mutation
            .then(() => {
                toast.success(isEditing ? 'Mission updated' : 'Mission created');
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
                    <DialogTitle>{isEditing ? 'Edit mission' : 'New mission'}</DialogTitle>
                    <DialogDescription>
                        Missions with no duration never expire and never get reminders.
                    </DialogDescription>
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
                                            <Target
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
                            name="xpGranted"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>XP granted</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Sparkles
                                                size={16}
                                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray"
                                            />
                                            <Input
                                                type="number"
                                                min={0}
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
                            name="durationDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Duration (days)</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Clock
                                                size={16}
                                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray"
                                            />
                                            <Input
                                                type="number"
                                                min={1}
                                                placeholder="No deadline"
                                                className="border-border-strong pl-9"
                                                {...field}
                                            />
                                        </div>
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
                                {isEditing ? 'Save changes' : 'Create mission'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
