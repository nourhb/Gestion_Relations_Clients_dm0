
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Briefcase, CheckCircle, Clock, ListChecks } from 'lucide-react';
import type { ServiceRequestAdminView } from '@/app/admin/requests/actions';

interface RequestsDashboardProps {
    requests: ServiceRequestAdminView[];
}

export default function RequestsDashboard({ requests }: RequestsDashboardProps) {

    const stats = useMemo(() => {
        const total = requests.length;
        const confirmed = requests.filter(r => r.status === 'confirmed').length;
        const pending = requests.filter(r => r.status === 'pending').length;
        const completed = requests.filter(r => r.status === 'completed').length;
        return { total, confirmed, pending, completed };
    }, [requests]);

    const chartData = useMemo(() => {
        const coaching = requests.filter(r => r.serviceType === 'coaching').length;
        const consultation = requests.filter(r => r.serviceType === 'consultation').length;
        return [
            { name: 'استشارة', count: consultation, fill: 'hsl(var(--primary))' },
            { name: 'تدريب', count: coaching, fill: 'hsl(var(--accent))' },
        ];
    }, [requests]);


    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">الطلبات المؤكدة</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.confirmed}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">الطلبات المعلقة</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.pending}</div>
                </CardContent>
            </Card>
            <Card className="lg:col-span-2">
                 <CardHeader>
                    <CardTitle className="text-sm font-medium">الطلبات حسب نوع الخدمة</CardTitle>
                 </CardHeader>
                 <CardContent className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis dataKey="name" type="category" width={60} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--background))',
                                    borderColor: 'hsl(var(--border))',
                                    direction: 'rtl',
                                }}
                            />
                            <Legend wrapperStyle={{direction: 'rtl'}} />
                            <Bar dataKey="count" name="عدد الطلبات" fill="fill" />
                        </BarChart>
                    </ResponsiveContainer>
                 </CardContent>
            </Card>
        </div>
    );
}
