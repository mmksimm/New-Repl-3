import { useState } from 'react';
import { useHapticFeedback } from "../hooks/useHapticFeedback";
import { useQuery } from "@tanstack/react-query";
import { useThemeLanguage } from "../contexts/ThemeLanguageContext";
import { useTranslation } from "../lib/translations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Users, Award } from "lucide-react";

interface BlockReward {
  userId: string;
  amount: number;
  type: 'miner' | 'participant';
}

interface Block {
  id: number;
  hash: string;
  nonce: string;
  minedBy: string;
  createdAt: string;
  completedAt: string;
  rewards?: BlockReward[];
}

export function BlockHistory() {
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const { impactOccurred, notificationOccurred } = useHapticFeedback();
  const { language } = useThemeLanguage();
  const t = useTranslation(language);

  const { data: blocks } = useQuery({
    queryKey: ["/api/blocks/history"],
  });

  const { data: blockRewards } = useQuery({
    queryKey: [`/api/blocks/${selectedBlock?.id}/rewards`],
    enabled: !!selectedBlock,
  });

  const handleBlockClick = (block: Block) => {
    impactOccurred('light');
    setSelectedBlock(block);
  };

  const handleDialogChange = (open: boolean) => {
    if (open) {
      impactOccurred('medium');
      notificationOccurred('success');
    } else {
      impactOccurred('light');
    }
    setSelectedBlock(null);
  };

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto mt-6 bg-black/60 backdrop-blur-sm border-slate-800">
        <CardHeader>
          <CardTitle>{t('blocks.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('blocks.number')}</TableHead>
                <TableHead>{t('blocks.hashShort')}</TableHead>
                <TableHead>{t('blocks.minedBy')}</TableHead>
                <TableHead>{t('blocks.time')}</TableHead>
                <TableHead>{t('blocks.participants')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks?.map((block: Block) => (
                <TableRow 
                  key={block.id}
                  className="cursor-pointer hover:bg-white/5"
                  onClick={() => handleBlockClick(block)}
                >
                  <TableCell>
                    <Badge variant="outline">#{block.id}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {block.hash.slice(0, 10)}...
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {block.minedBy}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(block.completedAt).toLocaleTimeString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {blockRewards?.filter(r => r.type === 'participant').length || 0}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog 
        open={!!selectedBlock} 
        onOpenChange={handleDialogChange}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {t('blocks.details')} #{selectedBlock?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">{t('blocks.fullHash')}</p>
              <p className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-md break-all">
                {selectedBlock?.hash}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">{t('blocks.miner')}</p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  <span>{selectedBlock?.minedBy}</span>
                  <Badge variant="secondary">
                    {blockRewards?.find(r => r.type === 'miner')?.amount || 0} {t('blocks.rewards')}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">{t('blocks.participants')}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span>{blockRewards?.filter(r => r.type === 'participant').length || 0}</span>
                  <Badge variant="secondary">
                    {blockRewards?.filter(r => r.type === 'participant')
                      .reduce((sum, r) => sum + r.amount, 0) || 0} {t('blocks.shared')}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('blocks.timestamps')}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{t('blocks.created')}:</span>
                  <span className="text-muted-foreground">
                    {new Date(selectedBlock?.createdAt || '').toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{t('blocks.completed')}:</span>
                  <span className="text-muted-foreground">
                    {new Date(selectedBlock?.completedAt || '').toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
