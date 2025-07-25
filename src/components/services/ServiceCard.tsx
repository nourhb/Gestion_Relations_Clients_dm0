
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ServiceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  dataAiHint: string;
  serviceKey: "coaching" | "consultation"; // Added serviceKey
}

export default function ServiceCard({ icon, title, description, imageSrc, imageAlt, dataAiHint, serviceKey }: ServiceCardProps) {
  return (
    <Link href={`/request?service=${serviceKey}`} className="block group">
      <Card className="overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
        <CardHeader className="flex flex-row items-start gap-3 p-5 bg-card">
          <div className="p-2 rounded-full bg-accent/10">
             {icon}
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-primary">{title}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground pt-1"> لمحة عن الخدمة </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-grow flex flex-col">
          <div className="relative h-48 w-full">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              className="object-cover"
              data-ai-hint={dataAiHint}
            />
          </div>
          <div className="p-5 flex-grow">
            <p className="text-foreground/90 leading-relaxed text-sm">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
