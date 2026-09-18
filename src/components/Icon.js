import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function Icon({ name, size = 20, color, style, ...props }) {
  return <Ionicons name={name} size={size} color={color} style={style} {...props} />;
}
