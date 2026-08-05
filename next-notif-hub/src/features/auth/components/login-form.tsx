'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { login } from '../api/login';
import { loginSchema, type LoginFormValues } from '../schemas/login-schema';
import { useAuthStore } from '@/store/auth-store';
import { homeRouteFor } from '@/config/constants/routes';
import ENDPOINTS from '@/config/constants/endpoints';
import { ApiError } from '@/lib/api-error';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function MicrosoftIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
    );
}

export function LoginForm() {
    const router = useRouter();
    const setSession = useAuthStore((s) => s.setSession);
    const [showPassword, setShowPassword] = useState(false);
    const [isRedirectingToMicrosoft, setIsRedirectingToMicrosoft] = useState(false);

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    const onSubmit = async (values: LoginFormValues) => {
        try {
            const { accessToken, refreshToken } = await login(values);
            setSession({ accessToken, refreshToken });
            const role = useAuthStore.getState().user?.role ?? 'employee';
            router.replace(homeRouteFor(role));
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        }
    };

    return (
        <div className="space-y-[22px]">
            <Button
                asChild
                variant="outline"
                className="h-[50px] w-full cursor-pointer gap-2.5 rounded-input border-1 border-border-strong bg-white text-[15px] font-semibold text-foreground shadow-card hover:bg-muted hover:text-foreground"
            >
                {/* Real full-page redirect into the backend's Authentik OIDC handshake — not a client-side transition */}
                <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}${ENDPOINTS.AUTH.OIDC_LOGIN}`}
                    onClick={() => setIsRedirectingToMicrosoft(true)}
                >
                    {isRedirectingToMicrosoft ? <Loader2 size={18} className="animate-spin" /> : <MicrosoftIcon />}
                    Sign in with Microsoft
                </a>
            </Button>

            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border-strong" />
                <span className="text-xs font-semibold tracking-widest text-gray uppercase">or</span>
                <div className="h-px flex-1 bg-border-strong" />
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-[22px]">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem className="gap-[7px]">
                                <FormLabel className="text-[12.5px] font-semibold text-foreground">
                                    Email
                                </FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Mail
                                            size={17}
                                            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gray"
                                        />
                                        <Input
                                            placeholder="email@example.com"
                                            type="email"
                                            autoComplete="email"
                                            className="h-12 rounded-input border-border bg-input pr-4  text-sm text-foreground"
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
                        name="password"
                        render={({ field }) => (
                            <FormItem className="gap-[7px]">
                                <FormLabel className="text-[12.5px] font-semibold text-foreground">
                                    Password
                                </FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            className="h-12 rounded-input border-border bg-input px-4 pr-10 text-sm text-foreground"
                                            {...field}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            className="absolute top-1/2 right-3.5 -translate-y-1/2 cursor-pointer text-gray hover:text-foreground"
                                        >
                                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                        </button>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                        style={{ backgroundImage: 'var(--gradient-primary-to-secondary-2)' }}
                        className="h-[50px] w-full cursor-pointer gap-2 rounded-input font-bold text-white shadow-primary-glow hover:brightness-105"
                    >
                        {form.formState.isSubmitting && <Loader2 size={18} className="animate-spin" />}
                        {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>
            </Form>
        </div>
    );
}
