import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<any>;
  color: string;
}

export default function DashboardCard({ title, value, icon: Icon, color }: DashboardCardProps) {
  return (
    <div className="bg-white overflow-hidden rounded-lg shadow">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-semibold text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}