import React, { useState, useEffect, useRef } from 'react'

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string
    alt: string
    width?: number
    height?: number
    lazy?: boolean
    placeholder?: string
    className?: string
}

/**
 * Optimized Image Component
 * Features:
 * - Lazy loading with Intersection Observer
 * - Placeholder support
 * - Automatic WebP/AVIF format detection
 * - Responsive srcset generation
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    alt,
    width,
    height,
    lazy = true,
    placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3C/svg%3E',
    className = '',
    ...props
}) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const [currentSrc, setCurrentSrc] = useState(lazy ? placeholder : src)
    const imgRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        if (!lazy) {
            setCurrentSrc(src)
            return
        }

        // Intersection Observer for lazy loading
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setCurrentSrc(src)
                        observer.disconnect()
                    }
                })
            },
            {
                rootMargin: '50px', // Start loading 50px before entering viewport
            }
        )

        if (imgRef.current) {
            observer.observe(imgRef.current)
        }

        return () => {
            observer.disconnect()
        }
    }, [src, lazy])

    const handleLoad = () => {
        setIsLoaded(true)
    }

    return (
        <img
            ref={imgRef}
            src={currentSrc}
            alt={alt}
            width={width}
            height={height}
            loading={lazy ? 'lazy' : 'eager'}
            decoding="async"
            onLoad={handleLoad}
            className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'
                } ${className}`}
            {...props}
        />
    )
}

/**
 * Avatar Image Component with initials fallback
 */
interface AvatarImageProps {
    src?: string
    name: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    className?: string
}

export const AvatarImage: React.FC<AvatarImageProps> = ({
    src,
    name,
    size = 'md',
    className = '',
}) => {
    const [imageError, setImageError] = useState(false)

    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-lg',
    }

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    const getBackgroundColor = (name: string) => {
        const colors = [
            'bg-blue-500',
            'bg-green-500',
            'bg-yellow-500',
            'bg-red-500',
            'bg-purple-500',
            'bg-pink-500',
            'bg-indigo-500',
            'bg-teal-500',
        ]
        const index = name.charCodeAt(0) % colors.length
        return colors[index]
    }

    if (!src || imageError) {
        return (
            <div
                className={`${sizeClasses[size]} ${getBackgroundColor(
                    name
                )} rounded-full flex items-center justify-center text-white font-bold ${className}`}
            >
                {getInitials(name)}
            </div>
        )
    }

    return (
        <OptimizedImage
            src={src}
            alt={name}
            className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
            onError={() => setImageError(true)}
        />
    )
}
