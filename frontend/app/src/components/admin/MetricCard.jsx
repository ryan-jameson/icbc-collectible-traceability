import React from 'react';
import PropTypes from 'prop-types';
import { Card, Statistic } from 'antd';

export const MetricCard = ({ title, value, icon = null, trend = null, footer = null }) => {
  return (
    <Card variant="borderless" style={{ borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 82, 217, 0.08)',
            color: '#0052d9'
          }}
        >
          {icon}
        </div>
        <Statistic title={title} value={value} valueStyle={{ fontSize: 28 }} suffix={trend} />
      </div>
      {footer && <div>{footer}</div>}
    </Card>
  );
};

MetricCard.propTypes = {
  title: PropTypes.node.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node,
  trend: PropTypes.node,
  footer: PropTypes.node
};
