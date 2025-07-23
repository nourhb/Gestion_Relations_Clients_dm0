
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, LineChart, Line, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

    const statusData = useMemo(() => {
        const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        return statuses.map(status => ({
            name: status === 'pending' ? 'معلق' : status === 'confirmed' ? 'مؤكد' : status === 'completed' ? 'مكتمل' : 'ملغى',
            value: requests.filter(r => r.status === status).length,
            key: status
        }));
    }, [requests]);
    const meetingTypeData = useMemo(() => {
        const types = ['online', 'in-person'];
        return types.map(type => ({
            name: type === 'online' ? 'أونلاين' : 'حضوري',
            value: requests.filter(r => r.meetingType === type).length
        }));
    }, [requests]);
    const requestsOverTime = useMemo(() => {
        const map: Record<string, number> = {};
        requests.forEach(r => {
            const date = r.createdAt?.slice(0, 10) || 'غير معروف';
            map[date] = (map[date] || 0) + 1;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
    }, [requests]);
    const serviceTypeStatusData = useMemo(() => {
        const types = ['coaching', 'consultation'];
        const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        return types.map(type => {
            const obj: any = { name: type === 'coaching' ? 'تدريب' : 'استشارة' };
            statuses.forEach(status => {
                obj[status] = requests.filter(r => r.serviceType === type && r.status === status).length;
            });
            return obj;
        });
    }, [requests]);
    const statusColors = ['#fbbf24', '#22c55e', '#3b82f6', '#ef4444'];
    return (
        <div className="space-y-6">
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
                            <ReBarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis dataKey="name" type="category" width={60} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" name="عدد الطلبات" fill="#6366f1" />
                            </ReBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">الطلبات حسب الحالة</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                                    {statusData.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={statusColors[idx % statusColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">الطلبات حسب نوع الاجتماع</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={meetingTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                                    <Cell fill="#06b6d4" />
                                    <Cell fill="#f59e42" />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="md:col-span-2 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">تطور الطلبات عبر الزمن</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={requestsOverTime} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="count" stroke="#10b981" name="عدد الطلبات" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="md:col-span-2 lg:col-span-4">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">الحالة حسب نوع الخدمة</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ReBarChart data={serviceTypeStatusData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="pending" stackId="a" fill="#fbbf24" name="معلق" />
                                <Bar dataKey="confirmed" stackId="a" fill="#22c55e" name="مؤكد" />
                                <Bar dataKey="completed" stackId="a" fill="#3b82f6" name="مكتمل" />
                                <Bar dataKey="cancelled" stackId="a" fill="#ef4444" name="ملغى" />
                            </ReBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
