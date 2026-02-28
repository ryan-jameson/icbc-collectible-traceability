import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Typography,
  Upload,
  message
} from 'antd';
import {
  BarcodeOutlined,
  DownloadOutlined,
  EditOutlined,
  HistoryOutlined,
  QrcodeOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUserCollectibles } from '../../services/userService';
import { getCollectibleHistory, updateCollectibleDetails } from '../../services/collectibleService';
import { buildCollectibleImageSrc } from '../../utils/collectibleImage';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

const MyCollectibles = () => {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data = { data: [], pagination: {} }, isLoading } = useQuery({
    queryKey: ['me', 'collectibles', { page }],
    queryFn: () => getCurrentUserCollectibles({ page, limit: 10 })
  });
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [selectedCollectible, setSelectedCollectible] = useState(null);
  const [editingCollectible, setEditingCollectible] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editImage, setEditImage] = useState(null);
  const [originalEditImage, setOriginalEditImage] = useState(null);
  const [editForm] = Form.useForm();
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [codeGenerating, setCodeGenerating] = useState(false);
  const [codeTarget, setCodeTarget] = useState(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateCollectibleDetails(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'collectibles'], exact: false });
    },
    onError: (error) => {
      const msg = error?.response?.data?.message || error?.message || '更新藏品信息失败';
      message.error(msg);
    }
  });

  const fetchHistory = useCallback(async (record) => {
    const blockchainId = record.blockchainId || record.blockchain_id;
    if (!blockchainId) {
      message.warning('无法获取该藏品的区块链编号');
      return;
    }

    setSelectedCollectible(record);
    setHistoryVisible(true);
    setHistoryLoading(true);
    setHistoryData(null);

    try {
      const response = await getCollectibleHistory(blockchainId);
      setHistoryData(response);
    } catch (error) {
      message.error(error.message || '获取流转历史失败');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const extractEstimatedValue = useCallback((record) => {
    if (!record) {
      return null;
    }
    if (record.estimatedValue !== undefined && record.estimatedValue !== null) {
      return record.estimatedValue;
    }
    if (record.estimated_value !== undefined && record.estimated_value !== null) {
      return record.estimated_value;
    }
    if (record.metadata?.estimatedValue !== undefined) {
      return record.metadata.estimatedValue;
    }
    return null;
  }, []);

  const openEditModal = useCallback(
    (record) => {
      const blockchainId = record.blockchainId || record.blockchain_id;
      if (!blockchainId) {
        message.warning('无法获取该藏品的区块链编号');
        return;
      }

      setEditingCollectible(record);
      const initialImage = buildCollectibleImageSrc(record);
      setEditImage(initialImage);
      setOriginalEditImage(initialImage);

      editForm.setFieldsValue({
        name: record.name || '',
        description: record.description || '',
        estimatedValue: extractEstimatedValue(record)
      });

      setEditVisible(true);
    },
    [editForm, extractEstimatedValue]
  );

  const closeEditModal = useCallback(() => {
    setEditVisible(false);
    setEditingCollectible(null);
    setEditImage(null);
    setOriginalEditImage(null);
    editForm.resetFields();
  }, [editForm]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingCollectible) {
      return;
    }

    try {
      const values = await editForm.validateFields();
      const payload = {};

      const trimmedName = typeof values.name === 'string' ? values.name.trim() : '';
      const originalName = editingCollectible.name || '';
      if (trimmedName && trimmedName !== originalName) {
        payload.name = trimmedName;
      }

      const trimmedDescription = typeof values.description === 'string' ? values.description.trim() : '';
      const originalDescription = editingCollectible.description || '';
      if (trimmedDescription !== originalDescription) {
        payload.description = trimmedDescription;
      }

      const normalizedEstimatedValue =
        values.estimatedValue === null || values.estimatedValue === undefined
          ? null
          : Number(values.estimatedValue);
      const originalEstimatedValue = extractEstimatedValue(editingCollectible);
      if (normalizedEstimatedValue !== originalEstimatedValue) {
        payload.estimatedValue = normalizedEstimatedValue;
      }

      const imageChanged = editImage !== originalEditImage;
      if (imageChanged) {
        payload.productPhoto = editImage;
      }

      if (!Object.keys(payload).length) {
        message.info('未检测到任何修改');
        return;
      }

      const collectibleId = editingCollectible.blockchainId || editingCollectible.blockchain_id;
      await updateMutation.mutateAsync({ id: collectibleId, payload });
      message.success('藏品信息更新成功');
      closeEditModal();
    } catch (error) {
      // 错误提示已在 mutation 的 onError 中处理，这里无需重复提示
    }
  }, [closeEditModal, editForm, editImage, editingCollectible, extractEstimatedValue, originalEditImage, updateMutation]);

  const handleImageBeforeUpload = useCallback((file) => {
    if (!file.type.startsWith('image/')) {
      message.error('仅支持图片文件');
      return Upload.LIST_IGNORE;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditImage(reader.result?.toString() || null);
    };
    reader.readAsDataURL(file);
    return false;
  }, []);

  const handleImageRemove = useCallback(() => {
    setEditImage(null);
    return true;
  }, []);

  const uploadFileList = useMemo(() => {
    if (!editImage) {
      return [];
    }
    return [
      {
        uid: '-1',
        name: 'product-photo',
        status: 'done',
        url: editImage
      }
    ];
  }, [editImage]);

  const resolveCollectibleHash = useCallback((record) => {
    return (
      record.hash ||
      record.collectibleHash ||
      record.collectible_hash ||
      record.blockchainHash ||
      record.blockchain_hash ||
      record.metadata?.hash ||
      record.metadata?.blockchainHash ||
      null
    );
  }, []);

  const openCodeModal = useCallback(
    (record) => {
      const blockchainId = record.blockchainId || record.blockchain_id;
      const collectibleHash = resolveCollectibleHash(record);

      if (!blockchainId || !collectibleHash) {
        message.warning('该藏品缺少编号或链上哈希，暂无法生成识别码');
        return;
      }

      setCodeTarget({
        name: record.name || '',
        blockchainId,
        hash: collectibleHash,
        barcodeValue: `${blockchainId}|${collectibleHash}`,
        qrValue: JSON.stringify({
          type: 'COLLECTIBLE',
          blockchainId,
          hash: collectibleHash
        })
      });
      setBarcodeDataUrl(null);
      setQrDataUrl(null);
      setCodeModalVisible(true);
    },
    [resolveCollectibleHash]
  );

  const closeCodeModal = useCallback(() => {
    setCodeModalVisible(false);
    setCodeGenerating(false);
    setCodeTarget(null);
    setBarcodeDataUrl(null);
    setQrDataUrl(null);
  }, []);

  useEffect(() => {
    if (!codeModalVisible || !codeTarget) {
      return;
    }

    const generateCodes = async () => {
      setCodeGenerating(true);
      try {
        const barcodeCanvas = document.createElement('canvas');
        JsBarcode(barcodeCanvas, codeTarget.barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 90,
          displayValue: true,
          text: codeTarget.blockchainId,
          fontSize: 14,
          margin: 12
        });
        setBarcodeDataUrl(barcodeCanvas.toDataURL('image/png'));

        const qrCodeUrl = await QRCode.toDataURL(codeTarget.qrValue, {
          width: 220,
          margin: 2
        });
        setQrDataUrl(qrCodeUrl);
      } catch (error) {
        console.error('生成识别码失败', error);
        message.error('生成识别码失败，请稍后重试');
      } finally {
        setCodeGenerating(false);
      }
    };

    generateCodes();
  }, [codeModalVisible, codeTarget]);

  const downloadDataUrl = useCallback((dataUrl, filename) => {
    if (!dataUrl) {
      message.warning('暂无可下载的图片');
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }, []);

  const handleDownloadQr = useCallback(() => {
    if (!codeTarget) {
      message.warning('请先生成识别码');
      return;
    }
    downloadDataUrl(qrDataUrl, `${codeTarget.blockchainId}-qr.png`);
  }, [codeTarget, downloadDataUrl, qrDataUrl]);

  const handleDownloadBarcode = useCallback(() => {
    if (!codeTarget) {
      message.warning('请先生成识别码');
      return;
    }
    downloadDataUrl(barcodeDataUrl, `${codeTarget.blockchainId}-barcode.png`);
  }, [barcodeDataUrl, codeTarget, downloadDataUrl]);

  const renderQualificationDetails = (qualification) => {
    if (!qualification) {
      return <Typography.Text type="secondary">—</Typography.Text>;
    }

    if (qualification.accountType === 'ENTERPRISE') {
      return (
        <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
          <Typography.Text>企业注册号：{qualification.enterpriseInfo?.registrationNumber || '—'}</Typography.Text>
          <Typography.Text>企业名称：{qualification.enterpriseInfo?.companyName || '—'}</Typography.Text>
        </Space>
      );
    }

    return (
      <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
        <Typography.Text>创作者平台：{qualification.personalInfo?.platform || '—'}</Typography.Text>
        <Typography.Text>平台ID：{qualification.personalInfo?.platformId || '—'}</Typography.Text>
        <Typography.Text>创作者姓名：{qualification.personalInfo?.personalName || '—'}</Typography.Text>
      </Space>
    );
  };

  const columns = [
    {
      title: '产品图片',
      dataIndex: 'productPhoto',
      width: 120,
      render: (_, record) => {
        const imageSrc = buildCollectibleImageSrc(record);
        return (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              background: '#f5f5f5',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={record.name || '藏品图片'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : null}
          </div>
        );
      }
    },
    {
      title: '藏品编号',
      dataIndex: 'blockchainId',
      render: (_, record) => record.blockchainId || record.blockchain_id || '--'
    },
    {
      title: '名称',
      dataIndex: 'name'
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      render: (status) => <Tag color={status === 'ACTIVE' ? 'blue' : 'gold'}>{status}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value) => (value ? new Date(value).toLocaleString() : '--')
    },
    {
      title: '操作',
      key: 'actions',
        width: 320,
      render: (_, record) => (
        <Space>
          <Button icon={<HistoryOutlined />} onClick={() => fetchHistory(record)}>
            流转历史
          </Button>
          <Button type="primary" ghost icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            修改信息
          </Button>
            <Button
              icon={<BarcodeOutlined />}
              onClick={() => openCodeModal(record)}
            >
              生成识别码
            </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3}>我的藏品</Typography.Title>
        <Typography.Paragraph type="secondary">
          查看您在区块链上的全部藏品资产明细。
        </Typography.Paragraph>
      </div>
      <Card variant="borderless">
        <Table
          rowKey={(record) => record.blockchainId || record.blockchain_id || record.id}
          columns={columns}
          loading={isLoading}
          dataSource={data.data}
          pagination={{
            current: page,
            total: data.pagination.total,
            pageSize: 10,
            onChange: (newPage) => setPage(newPage)
          }}
        />
      </Card>

      <Modal
        width={720}
        open={historyVisible}
        footer={null}
        destroyOnClose
        onCancel={() => {
          setHistoryVisible(false);
          setHistoryData(null);
          setSelectedCollectible(null);
        }}
        title={selectedCollectible
          ? `${selectedCollectible.name || '藏品'} · ${selectedCollectible.blockchainId || selectedCollectible.blockchain_id || ''}`
          : '藏品流转历史'}
      >
        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" />
          </div>
        ) : historyData?.events?.length ? (
          <Timeline style={{ marginTop: 16 }}>
            {historyData.events.map((event, index) => (
              <Timeline.Item key={`${event.id || index}-${index}`}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Typography.Text strong>{event.type === 'CLAIM' ? '认领' : '所有权转移'}</Typography.Text>
                  <Typography.Text type="secondary">
                    时间：{event.timestamp ? new Date(event.timestamp).toLocaleString() : '未知'}
                  </Typography.Text>
                  <div>
                    <Typography.Text type="secondary">转出方：</Typography.Text>
                    {renderQualificationDetails(event.fromQualification)}
                  </div>
                  <div>
                    <Typography.Text type="secondary">转入方：</Typography.Text>
                    {renderQualificationDetails(event.toQualification)}
                  </div>
                </Space>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            暂无流转记录。
          </Typography.Paragraph>
        )}
      </Modal>

      <Modal
        width={640}
        open={codeModalVisible}
        destroyOnClose
        onCancel={closeCodeModal}
        title={codeTarget ? `${codeTarget.name || '藏品'} · 识别码生成` : '识别码生成'}
        footer={[
          <Button
            key="download-qr"
            icon={<DownloadOutlined />}
            onClick={handleDownloadQr}
            disabled={!codeTarget || codeGenerating}
          >
            下载二维码
          </Button>,
          <Button
            key="download-barcode"
            icon={<DownloadOutlined />}
            onClick={handleDownloadBarcode}
            disabled={!codeTarget || codeGenerating}
          >
            下载条形码
          </Button>,
          <Button key="close" onClick={closeCodeModal}>
            关闭
          </Button>
        ]}
      >
        {codeTarget ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Typography.Text>
              链上编号：
              <Typography.Text code>{codeTarget.blockchainId}</Typography.Text>
            </Typography.Text>
            <Typography.Text>
              链上哈希：
              <Typography.Text code style={{ wordBreak: 'break-all' }}>
                {codeTarget.hash}
              </Typography.Text>
            </Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              识别码将编码藏品编号与链上哈希信息，可用于打印并贴附于实体物品以验证身份。
            </Typography.Paragraph>
            <Spin spinning={codeGenerating} tip="生成中...">
              <Space size={32} wrap align="center" style={{ width: '100%', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <Typography.Text strong>
                    <QrcodeOutlined style={{ marginRight: 8 }} />二维码
                  </Typography.Text>
                  <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 8 }}>
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="藏品二维码"
                        style={{ width: 220, height: 220 }}
                      />
                    ) : (
                      <Typography.Text type="secondary">正在生成二维码...</Typography.Text>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Typography.Text strong>
                    <BarcodeOutlined style={{ marginRight: 8 }} />条形码
                  </Typography.Text>
                  <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 8 }}>
                    {barcodeDataUrl ? (
                      <img
                        src={barcodeDataUrl}
                        alt="藏品条形码"
                        style={{ maxWidth: 280 }}
                      />
                    ) : (
                      <Typography.Text type="secondary">正在生成条形码...</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </Spin>
          </Space>
        ) : (
          <Typography.Paragraph type="secondary">请选择一件藏品以生成识别码。</Typography.Paragraph>
        )}
      </Modal>

      <Modal
        width={520}
        open={editVisible}
        title={editingCollectible ? `${editingCollectible.name || '藏品'} · 信息修改` : '修改藏品信息'}
        okText="保存"
        cancelText="取消"
        onCancel={closeEditModal}
        onOk={handleEditSubmit}
        confirmLoading={updateMutation.isLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={editForm} preserve={false}>
          <Form.Item
            name="name"
            label="产品名称"
            rules={[{ required: true, message: '请输入产品名称' }]}
          >
            <Input placeholder="请输入产品名称" maxLength={120} showCount allowClear />
          </Form.Item>
          <Form.Item name="description" label="产品描述">
            <Input.TextArea rows={4} placeholder="请填写产品描述" maxLength={500} showCount allowClear />
          </Form.Item>
          <Form.Item
            name="estimatedValue"
            label="预估定价"
            tooltip="填写数字，单位与原定价保持一致"
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入预估定价" />
          </Form.Item>
          <Form.Item label="产品图片">
            <Upload
              listType="picture-card"
              fileList={uploadFileList}
              onRemove={handleImageRemove}
              beforeUpload={handleImageBeforeUpload}
              accept="image/*"
              maxCount={1}
              showUploadList={{ showPreviewIcon: false }}
            >
              {uploadFileList.length ? null : (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>上传图片</div>
                </div>
              )}
            </Upload>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
              仅支持图片格式，大小不超过 10MB。如需移除当前图片，可点击缩略图右上角的删除按钮。
            </Typography.Paragraph>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MyCollectibles;
