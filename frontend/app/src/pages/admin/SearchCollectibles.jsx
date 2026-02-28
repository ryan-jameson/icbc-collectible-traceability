import React, { useMemo, useState } from 'react';
import { Card, Col, Empty, Form, Input, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { listCollectibles } from '../../services/collectibleService';
import { buildCollectibleImageSrc } from '../../utils/collectibleImage';

const statusOptions = [
  { label: '全部状态', value: undefined },
  { label: '待审批', value: 'PENDING_REVIEW' },
  { label: '已上线', value: 'ACTIVE' },
  { label: '转移中', value: 'TRANSFER_PENDING' }
];

const mapOwner = (collectible) =>
  collectible.currentOwnerName ||
  collectible.current_owner_name ||
  collectible.currentOwnerId ||
  collectible.current_owner_id ||
  '—';

const normalizeId = (collectible) => collectible.blockchainId || collectible.blockchain_id || collectible.id;

const enrichCollectibles = (items = []) =>
  items.map((item) => ({
    ...item,
    blockchainId: normalizeId(item),
    currentOwnerDisplay: mapOwner(item)
  }));

const SearchCollectibles = () => {
  const [filters, setFilters] = useState({ keyword: '', status: 'ACTIVE', page: 1 });

  const { data: searchResult = { data: [], pagination: {} }, isLoading } = useQuery({
    queryKey: ['collectibles', 'admin-search', filters],
    queryFn: () =>
      listCollectibles({
        keyword: filters.keyword || undefined,
        status: filters.status || undefined,
        page: filters.page,
        limit: 10
      }).then((res) => ({
        ...res,
        data: enrichCollectibles(res.data)
      })),
    keepPreviousData: true
  });

  const {
    data: unassigned = { data: [] },
    isLoading: loadingUnassigned
  } = useQuery({
    queryKey: ['collectibles', 'admin-unassigned'],
    queryFn: () =>
      listCollectibles({
        status: 'ACTIVE',
        page: 1,
        limit: 50
      }).then((res) => ({
        ...res,
        data: enrichCollectibles(res.data)
      }))
  });

  const suggestedCollectibles = useMemo(() => {
    const items = unassigned.data || [];
    return items.filter((item) => {
      const owner = item.currentOwnerId ?? item.current_owner_id;
      return !owner;
    }).slice(0, 8);
  }, [unassigned.data]);

  const columns = useMemo(
    () => [
      {
        title: '藏品',
        dataIndex: 'name',
        width: 320,
        render: (_, record) => {
          const imageSrc = buildCollectibleImageSrc(record);
          return (
            <Space align="start" size={16}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {imageSrc ? (
                  <img src={imageSrc} alt={record.name || '藏品图片'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <div>
                <Typography.Text strong>{record.name || '未命名藏品'}</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  藏品编号：{record.blockchainId || '—'}
                </Typography.Paragraph>
              </div>
            </Space>
          );
        }
      },
      {
        title: '品牌',
        dataIndex: 'brand_name',
        render: (value) => value || '—'
      },
      {
        title: '当前所有者',
        dataIndex: 'currentOwnerDisplay'
      },
      {
        title: '哈希',
        dataIndex: 'hash',
        render: (value) => value || '—'
      },
      {
        title: '状态',
        dataIndex: 'status',
        render: (status) => <Tag color={status === 'ACTIVE' ? 'blue' : status === 'TRANSFER_PENDING' ? 'orange' : 'gold'}>{status || '未知'}</Tag>
      }
    ],
    []
  );

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>链上藏品检索</Typography.Title>
        <Typography.Paragraph type="secondary">
          通过名称或编号快速定位区块链上的藏品，支持审核链上编号与信息发布。
        </Typography.Paragraph>
      </div>

      <Card variant="borderless">
        <Form
          layout="inline"
          initialValues={filters}
          onValuesChange={(changedValues, allValues) => setFilters((prev) => ({ ...prev, ...allValues, page: 1 }))}
        >
          <Form.Item name="keyword" style={{ flex: 1, minWidth: 240 }}>
            <Input.Search
              allowClear
              placeholder="输入藏品名称或编号关键字"
              onSearch={(value) => setFilters((prev) => ({ ...prev, keyword: value, page: 1 }))}
            />
          </Form.Item>
          <Form.Item name="status">
            <Select allowClear style={{ width: 180 }} placeholder="选择状态" options={statusOptions} />
          </Form.Item>
        </Form>
      </Card>

      <Card variant="borderless" style={{ marginTop: 24 }}>
        <Table
          rowKey={(record) => record.blockchainId || record.id}
          columns={columns}
          loading={isLoading}
          dataSource={searchResult.data}
          pagination={{
            current: filters.page,
            pageSize: 10,
            total: searchResult.pagination?.total,
            onChange: (page) => setFilters((prev) => ({ ...prev, page }))
          }}
          locale={{ emptyText: '暂无匹配的链上藏品' }}
        />
      </Card>

      <Card
        title="猜你想搜"
        variant="borderless"
        style={{ marginTop: 24 }}
        loading={loadingUnassigned}
        extra={suggestedCollectibles.length ? `待指派 ${suggestedCollectibles.length} 件` : undefined}
      >
        {suggestedCollectibles.length ? (
          <Row gutter={[24, 24]}>
            {suggestedCollectibles.map((item) => {
              const imageSrc = buildCollectibleImageSrc(item);
              return (
                <Col key={item.blockchainId || item.id} xs={24} sm={12} lg={8} xl={6}>
                  <Card
                    hoverable
                    bodyStyle={{ padding: 16 }}
                    style={{ height: '100%' }}
                    cover={
                      imageSrc ? (
                        <img
                          alt={item.name || '藏品图片'}
                          src={imageSrc}
                          style={{ width: '100%', height: 160, objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: 160,
                            background: '#f5f5f5',
                            borderRadius: '8px 8px 0 0'
                          }}
                        />
                      )
                    }
                  >
                    <Typography.Title level={5} style={{ marginBottom: 12 }}>
                      {item.name || '未命名藏品'}
                    </Typography.Title>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Typography.Text type="secondary">藏品编号</Typography.Text>
                      <Typography.Text strong>{item.blockchainId || '—'}</Typography.Text>
                      <Typography.Text type="secondary">链上哈希</Typography.Text>
                      <Typography.Text copyable ellipsis={{ tooltip: item.hash }}>
                        {item.hash || '暂无'}
                      </Typography.Text>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty description="暂无待指派的链上藏品" />
        )}
      </Card>
    </div>
  );
};

export default SearchCollectibles;
