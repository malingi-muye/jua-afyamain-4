"use client"

import React from 'react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from 'recharts'

interface ChartProps {
    data: any[]
    type: 'bar' | 'area' | 'pie'
    colors?: string[]
    height?: number
}

export const DashboardCharts: React.FC<ChartProps> = ({ data, type, colors = ["#3462ee", "#4a91a8", "#efe347", "#eaf0dc", "#121721"], height = 180 }) => {
    if (type === 'bar') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} barSize={12}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.1} strokeDasharray="4 4" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        dy={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                        cursor={{ fill: "transparent" }}
                        contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="val" fill="#0d9488" radius={[4, 4, 4, 4]} />
                </BarChart>
            </ResponsiveContainer>
        )
    }

    if (type === 'area') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3462EE" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3462EE" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeOpacity={0.1} strokeDasharray="4 4" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        dy={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                    />
                    <Area type="monotone" dataKey="val" stroke="#3462EE" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
            </ResponsiveContainer>
        )
    }

    if (type === 'pie') {
        return (
            <ResponsiveContainer width="100%" height={height}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="val"
                    >
                        {data.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                </PieChart>
            </ResponsiveContainer>
        )
    }

    return null
}
