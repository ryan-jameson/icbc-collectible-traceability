import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="页面未找到"
      subTitle="抱歉，您访问的页面不存在或已被移除。"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>返回首页</Button>
      }
    />
  );
};

export default NotFound;
